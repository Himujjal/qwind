(() => {
  // ../tailwindcss/packages/tailwindcss/package.json
  var version = "4.3.3";

  // ../tailwindcss/packages/tailwindcss/src/selector-parser.ts
  function combinator(value2) {
    return {
      kind: "combinator",
      value: value2
    };
  }
  function complex(nodes) {
    return {
      kind: "complex",
      nodes
    };
  }
  function compound(nodes) {
    return {
      kind: "compound",
      nodes
    };
  }
  function fun(value2, nodes) {
    return {
      kind: "function",
      value: value2,
      nodes
    };
  }
  function list(nodes) {
    return {
      kind: "list",
      nodes
    };
  }
  function selector(value2) {
    return {
      kind: "selector",
      value: value2
    };
  }
  function value(value2) {
    return {
      kind: "value",
      value: value2
    };
  }
  function isUniversalSelector(node) {
    return node.kind === "selector" && node.value.charCodeAt(0) === ASTERISK;
  }
  function isTypeSelector(node) {
    if (node.kind !== "selector") return false;
    switch (node.value.charCodeAt(0)) {
      case ASTERISK:
      // Universal selector
      case AMPERSAND:
      // Nesting selector
      case DOT:
      // Class selector
      case HASH:
      // ID selector
      case COLON:
      // Pseudo selector
      case OPEN_BRACKET:
        return false;
      // We don't fully verify whether this is actually a proper type selector,
      // but we assume it is one if it's not any of the other ones.
      default:
        return true;
    }
  }
  function toCss(ast, minify = false) {
    let css = "";
    for (let node of ast) {
      switch (node.kind) {
        case "selector":
        case "value": {
          css += node.value;
          break;
        }
        case "combinator": {
          if (minify || node.value === " ") {
            css += node.value;
          } else {
            css += ` ${node.value} `;
          }
          break;
        }
        case "function": {
          css += `${node.value}(${toCss(node.nodes, minify)})`;
          break;
        }
        case "complex":
        case "compound": {
          css += toCss(node.nodes, minify);
          break;
        }
        case "list": {
          css += node.nodes.map((node2) => toCss([node2], minify)).join(minify ? "," : ", ");
          break;
        }
      }
    }
    return css;
  }
  var BACKSLASH = 92;
  var CLOSE_BRACKET = 93;
  var CLOSE_PAREN = 41;
  var COLON = 58;
  var COMMA = 44;
  var DOUBLE_QUOTE = 34;
  var DOT = 46;
  var GREATER_THAN = 62;
  var NEWLINE = 10;
  var HASH = 35;
  var OPEN_BRACKET = 91;
  var OPEN_PAREN = 40;
  var PLUS = 43;
  var SINGLE_QUOTE = 39;
  var SPACE = 32;
  var TAB = 9;
  var TILDE = 126;
  var AMPERSAND = 38;
  var ASTERISK = 42;
  function parse(input) {
    input = input.replaceAll("\r\n", "\n");
    let ast = [];
    let target = ast;
    let containsCombinator = false;
    let contextStack = [];
    let currentList = null;
    let buffer = "";
    let peekChar;
    function current(nodes = target) {
      return nodes.length === 1 ? nodes[0] : containsCombinator ? complex(nodes) : compound(nodes);
    }
    function append(node) {
      let existing = target[target.length - 1];
      if (existing?.kind === "compound") {
        existing.nodes.push(node);
      } else if (existing && existing.kind !== "list" && existing.kind !== "combinator") {
        target[target.length - 1] = compound([existing, node]);
      } else {
        target.push(node);
      }
    }
    for (let i = 0; i < input.length; i++) {
      let currentChar = input.charCodeAt(i);
      switch (currentChar) {
        // Handle selector lists
        //
        // ```css
        // .foo, .bar {}
        //     ^
        // ```
        case COMMA: {
          if (buffer.length > 0) {
            append(selector(buffer));
            buffer = "";
          }
          for (; i + 1 < input.length; i++) {
            peekChar = input.charCodeAt(i + 1);
            if (peekChar !== NEWLINE && peekChar !== SPACE && peekChar !== TAB) {
              break;
            }
          }
          if (currentList) {
            currentList.nodes.push(current());
            target = [];
            containsCombinator = false;
          } else {
            let nodes = target.splice(0);
            let item = current(nodes);
            let node = list([item]);
            target.push(node);
            currentList = node;
            target = [];
            containsCombinator = false;
          }
          break;
        }
        // Handle combinators
        //
        // E.g.:
        //
        // ```css
        // .foo .bar
        //     ^
        //
        // .foo > .bar
        //     ^^^
        // ```
        case GREATER_THAN:
        case NEWLINE:
        case SPACE:
        case PLUS:
        case TAB:
        case TILDE: {
          if (buffer.length > 0) {
            append(selector(buffer));
            buffer = "";
          }
          let start = i;
          let end = i + 1;
          for (; end < input.length; end++) {
            peekChar = input.charCodeAt(end);
            if (peekChar !== GREATER_THAN && peekChar !== NEWLINE && peekChar !== SPACE && peekChar !== PLUS && peekChar !== TAB && peekChar !== TILDE) {
              break;
            }
          }
          i = end - 1;
          let value2 = input.slice(start, end).trim();
          if (value2 === "" && (target.length === 0 || end >= input.length || input.charCodeAt(end) === COMMA)) {
            break;
          }
          target.push(combinator(value2 === "" ? " " : value2));
          containsCombinator = true;
          break;
        }
        // Start of a function call
        //
        // E.g.:
        //
        // ```css
        // .foo:not(.bar)
        //         ^
        // ```
        case OPEN_PAREN: {
          let node = fun(buffer, []);
          buffer = "";
          if (node.value !== ":not" && node.value !== ":where" && node.value !== ":has" && node.value !== ":is") {
            let start = i + 1;
            let nesting = 0;
            for (let j = i + 1; j < input.length; j++) {
              peekChar = input.charCodeAt(j);
              if (peekChar === OPEN_PAREN) {
                nesting++;
                continue;
              }
              if (peekChar === CLOSE_PAREN) {
                if (nesting === 0) {
                  i = j;
                  break;
                }
                nesting--;
              }
            }
            let end = i;
            let contents = input.slice(start, end);
            if (node.value === ":nth-child" || node.value === ":nth-last-child") {
              let idx = contents.indexOf("of ");
              if (idx !== -1) {
                node.nodes.push(
                  value(
                    contents.slice(0, idx + 3)
                    // value `2n + 1 of `
                  ),
                  ...parse(
                    contents.slice(idx + 3)
                    // `.foo, .bar`
                  )
                );
                buffer = "";
                i = end;
                append(node);
                break;
              }
            }
            node.nodes.push(value(contents));
            buffer = "";
            i = end;
            append(node);
            break;
          }
          append(node);
          contextStack.push({ target, currentList, containsCombinator });
          target = node.nodes;
          containsCombinator = false;
          currentList = null;
          break;
        }
        // End of a function call
        //
        // E.g.:
        //
        // ```css
        // foo(bar, baz)
        //             ^
        // ```
        case CLOSE_PAREN: {
          if (buffer.length > 0) {
            append(selector(buffer));
            buffer = "";
          }
          if (currentList) {
            currentList.nodes.push(current());
          } else if (containsCombinator) {
            target.splice(0, target.length, complex(target.splice(0)));
          }
          let context2 = contextStack.pop();
          target = context2?.target ?? ast;
          currentList = context2?.currentList ?? null;
          containsCombinator = context2?.containsCombinator ?? false;
          break;
        }
        // Split compound selectors
        //
        // E.g.:
        //
        // ```css
        // .foo.bar
        //     ^
        // ```
        case DOT:
        case COLON:
        case HASH: {
          if (currentChar === COLON && buffer === ":") {
            buffer += input[i];
            break;
          }
          if (buffer.length > 0) {
            append(selector(buffer));
          }
          buffer = input[i];
          break;
        }
        // Start of an attribute selector
        //
        // NOTE: Right now we don't care about the individual parts of the
        // attribute selector, we just want to find the matching closing bracket.
        //
        // If we need more information from inside the attribute selector in the
        // future, then we can use the `AttributeSelectorParser` here (and even
        // inline it if needed)
        case OPEN_BRACKET: {
          if (buffer.length > 0) {
            append(selector(buffer));
            buffer = "";
          }
          let start = i;
          let nesting = 0;
          for (let j = i + 1; j < input.length; j++) {
            peekChar = input.charCodeAt(j);
            if (peekChar === OPEN_BRACKET) {
              nesting++;
              continue;
            }
            if (peekChar === CLOSE_BRACKET) {
              if (nesting === 0) {
                i = j;
                break;
              }
              nesting--;
            }
          }
          append(selector(input.slice(start, i + 1)));
          break;
        }
        // Start of a string
        case SINGLE_QUOTE:
        case DOUBLE_QUOTE: {
          let start = i;
          for (let j = i + 1; j < input.length; j++) {
            peekChar = input.charCodeAt(j);
            if (peekChar === BACKSLASH) {
              j += 1;
            } else if (peekChar === currentChar) {
              i = j;
              break;
            }
          }
          buffer += input.slice(start, i + 1);
          break;
        }
        // Nesting `&` is always a new selector
        // Universal `*` is always a new selector
        case AMPERSAND:
        case ASTERISK: {
          if (buffer.length > 0) {
            append(selector(buffer));
            buffer = "";
          }
          append(selector(input[i]));
          break;
        }
        // Escaped characters
        case BACKSLASH: {
          buffer += input[i] + input[i + 1];
          i += 1;
          break;
        }
        // Everything else will be collected in the buffer
        default: {
          buffer += input[i];
        }
      }
    }
    if (buffer.length > 0) {
      append(selector(buffer));
    }
    if (currentList) {
      currentList.nodes.push(current());
    } else if (containsCombinator) {
      target.splice(0, target.length, complex(target.splice(0)));
    }
    return ast;
  }

  // ../tailwindcss/packages/tailwindcss/src/source-maps/line-table.ts
  var LINE_BREAK = 10;
  function createLineTable(source) {
    let table = [0];
    for (let i = 0; i < source.length; i++) {
      if (source.charCodeAt(i) === LINE_BREAK) {
        table.push(i + 1);
      }
    }
    function find(offset) {
      let line = 0;
      let count = table.length;
      while (count > 0) {
        let mid = (count | 0) >> 1;
        let i = line + mid;
        if (table[i] <= offset) {
          line = i + 1;
          count = count - mid - 1;
        } else {
          count = mid;
        }
      }
      line -= 1;
      let column = offset - table[line];
      return {
        line: line + 1,
        column
      };
    }
    function findOffset({ line, column }) {
      line -= 1;
      line = Math.min(Math.max(line, 0), table.length - 1);
      let offsetA = table[line];
      let offsetB = table[line + 1] ?? offsetA;
      return Math.min(Math.max(offsetA + column, 0), offsetB);
    }
    return {
      find,
      findOffset
    };
  }

  // ../tailwindcss/packages/tailwindcss/src/css-parser.ts
  var BACKSLASH2 = 92;
  var SLASH = 47;
  var ASTERISK2 = 42;
  var DOUBLE_QUOTE2 = 34;
  var SINGLE_QUOTE2 = 39;
  var COLON2 = 58;
  var SEMICOLON = 59;
  var LINE_BREAK2 = 10;
  var CARRIAGE_RETURN = 13;
  var SPACE2 = 32;
  var TAB2 = 9;
  var OPEN_CURLY = 123;
  var CLOSE_CURLY = 125;
  var OPEN_PAREN2 = 40;
  var CLOSE_PAREN2 = 41;
  var OPEN_BRACKET2 = 91;
  var CLOSE_BRACKET2 = 93;
  var DASH = 45;
  var AT_SIGN = 64;
  var EXCLAMATION_MARK = 33;
  var CssSyntaxError = class _CssSyntaxError extends Error {
    loc;
    constructor(message, loc) {
      if (loc) {
        let source = loc[0];
        let start = createLineTable(source.code).find(loc[1]);
        message = `${source.file}:${start.line}:${start.column + 1}: ${message}`;
      }
      super(message);
      this.name = "CssSyntaxError";
      this.loc = loc;
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, _CssSyntaxError);
      }
    }
  };
  function parse2(input, opts) {
    let source = opts?.from ? { file: opts.from, code: input } : null;
    if (input[0] === "\uFEFF") input = " " + input.slice(1);
    let ast = [];
    let licenseComments = [];
    let stack = [];
    let parent = null;
    let node = null;
    let buffer = "";
    let closingBracketStack3 = "";
    let bufferStart = 0;
    let peekChar;
    for (let i = 0; i < input.length; i++) {
      let currentChar = input.charCodeAt(i);
      if (currentChar === CARRIAGE_RETURN) {
        peekChar = input.charCodeAt(i + 1);
        if (peekChar === LINE_BREAK2) continue;
      }
      if (currentChar === BACKSLASH2) {
        if (buffer === "") bufferStart = i;
        buffer += input.slice(i, i + 2);
        i += 1;
      } else if (currentChar === SLASH && input.charCodeAt(i + 1) === ASTERISK2) {
        let start = i;
        for (let j = i + 2; j < input.length; j++) {
          peekChar = input.charCodeAt(j);
          if (peekChar === BACKSLASH2) {
            j += 1;
          } else if (peekChar === ASTERISK2 && input.charCodeAt(j + 1) === SLASH) {
            i = j + 1;
            break;
          }
        }
        let commentString = input.slice(start, i + 1);
        if (commentString.charCodeAt(2) === EXCLAMATION_MARK) {
          let node2 = comment(commentString.slice(2, -2));
          licenseComments.push(node2);
          if (source) {
            node2.src = [source, start, i + 1];
            node2.dst = [source, start, i + 1];
          }
        }
      } else if (currentChar === SINGLE_QUOTE2 || currentChar === DOUBLE_QUOTE2) {
        let end = parseString(input, i, currentChar, source);
        buffer += input.slice(i, end + 1);
        i = end;
      } else if ((currentChar === SPACE2 || currentChar === LINE_BREAK2 || currentChar === TAB2) && (peekChar = input.charCodeAt(i + 1)) && (peekChar === SPACE2 || peekChar === LINE_BREAK2 || peekChar === TAB2 || peekChar === CARRIAGE_RETURN && (peekChar = input.charCodeAt(i + 2)) && peekChar == LINE_BREAK2)) {
        continue;
      } else if (currentChar === LINE_BREAK2) {
        if (buffer.length === 0) continue;
        peekChar = buffer.charCodeAt(buffer.length - 1);
        if (peekChar !== SPACE2 && peekChar !== LINE_BREAK2 && peekChar !== TAB2) {
          buffer += " ";
        }
      } else if (currentChar === DASH && input.charCodeAt(i + 1) === DASH && buffer.length === 0) {
        let closingBracketStack4 = "";
        let start = i;
        let colonIdx = -1;
        for (let j = i + 2; j < input.length; j++) {
          peekChar = input.charCodeAt(j);
          if (peekChar === BACKSLASH2) {
            j += 1;
          } else if (peekChar === SINGLE_QUOTE2 || peekChar === DOUBLE_QUOTE2) {
            j = parseString(input, j, peekChar, source);
          } else if (peekChar === SLASH && input.charCodeAt(j + 1) === ASTERISK2) {
            for (let k = j + 2; k < input.length; k++) {
              peekChar = input.charCodeAt(k);
              if (peekChar === BACKSLASH2) {
                k += 1;
              } else if (peekChar === ASTERISK2 && input.charCodeAt(k + 1) === SLASH) {
                j = k + 1;
                break;
              }
            }
          } else if (colonIdx === -1 && peekChar === COLON2) {
            colonIdx = buffer.length + j - start;
          } else if (peekChar === SEMICOLON && closingBracketStack4.length === 0) {
            buffer += input.slice(start, j);
            i = j;
            break;
          } else if (peekChar === OPEN_PAREN2) {
            closingBracketStack4 += ")";
          } else if (peekChar === OPEN_BRACKET2) {
            closingBracketStack4 += "]";
          } else if (peekChar === OPEN_CURLY) {
            closingBracketStack4 += "}";
          } else if ((peekChar === CLOSE_CURLY || input.length - 1 === j) && closingBracketStack4.length === 0) {
            i = j - 1;
            buffer += input.slice(start, j);
            break;
          } else if (peekChar === CLOSE_PAREN2 || peekChar === CLOSE_BRACKET2 || peekChar === CLOSE_CURLY) {
            if (closingBracketStack4.length > 0 && input[j] === closingBracketStack4[closingBracketStack4.length - 1]) {
              closingBracketStack4 = closingBracketStack4.slice(0, -1);
            }
          }
        }
        let declaration = parseDeclaration(buffer, colonIdx);
        if (!declaration) {
          throw new CssSyntaxError(
            `Invalid custom property, expected a value`,
            source ? [source, start, i] : null
          );
        }
        if (source) {
          declaration.src = [source, start, i];
          declaration.dst = [source, start, i];
        }
        if (parent) {
          parent.nodes.push(declaration);
        } else {
          ast.push(declaration);
        }
        buffer = "";
      } else if (currentChar === SEMICOLON && buffer.charCodeAt(0) === AT_SIGN) {
        node = parseAtRule(buffer);
        if (source) {
          node.src = [source, bufferStart, i];
          node.dst = [source, bufferStart, i];
        }
        if (parent) {
          parent.nodes.push(node);
        } else {
          ast.push(node);
        }
        buffer = "";
        node = null;
      } else if (currentChar === SEMICOLON && closingBracketStack3[closingBracketStack3.length - 1] !== ")") {
        let declaration = parseDeclaration(buffer);
        if (!declaration) {
          if (buffer.length === 0) continue;
          throw new CssSyntaxError(
            `Invalid declaration: \`${buffer.trim()}\``,
            source ? [source, bufferStart, i] : null
          );
        }
        if (source) {
          declaration.src = [source, bufferStart, i];
          declaration.dst = [source, bufferStart, i];
        }
        if (parent) {
          parent.nodes.push(declaration);
        } else {
          ast.push(declaration);
        }
        buffer = "";
      } else if (currentChar === OPEN_CURLY && closingBracketStack3[closingBracketStack3.length - 1] !== ")") {
        closingBracketStack3 += "}";
        node = rule(buffer.trim());
        if (source) {
          node.src = [source, bufferStart, i];
          node.dst = [source, bufferStart, i];
        }
        if (parent) {
          parent.nodes.push(node);
        }
        stack.push(parent);
        parent = node;
        buffer = "";
        node = null;
      } else if (currentChar === CLOSE_CURLY && closingBracketStack3[closingBracketStack3.length - 1] !== ")") {
        if (closingBracketStack3 === "") {
          throw new CssSyntaxError("Missing opening {", source ? [source, i, i] : null);
        }
        closingBracketStack3 = closingBracketStack3.slice(0, -1);
        if (buffer.length > 0) {
          if (buffer.charCodeAt(0) === AT_SIGN) {
            node = parseAtRule(buffer);
            if (source) {
              node.src = [source, bufferStart, i];
              node.dst = [source, bufferStart, i];
            }
            if (parent) {
              parent.nodes.push(node);
            } else {
              ast.push(node);
            }
            buffer = "";
            node = null;
          } else {
            let colonIdx = buffer.indexOf(":");
            if (parent) {
              let node2 = parseDeclaration(buffer, colonIdx);
              if (!node2) {
                throw new CssSyntaxError(
                  `Invalid declaration: \`${buffer.trim()}\``,
                  source ? [source, bufferStart, i] : null
                );
              }
              if (source) {
                node2.src = [source, bufferStart, i];
                node2.dst = [source, bufferStart, i];
              }
              parent.nodes.push(node2);
            }
          }
        }
        let grandParent = stack.pop() ?? null;
        if (grandParent === null && parent) {
          ast.push(parent);
        }
        parent = grandParent;
        buffer = "";
        node = null;
      } else if (currentChar === OPEN_PAREN2) {
        closingBracketStack3 += ")";
        buffer += "(";
      } else if (currentChar === CLOSE_PAREN2) {
        if (closingBracketStack3[closingBracketStack3.length - 1] !== ")") {
          throw new CssSyntaxError("Missing opening (", source ? [source, i, i] : null);
        }
        closingBracketStack3 = closingBracketStack3.slice(0, -1);
        buffer += ")";
      } else {
        if (buffer.length === 0 && (currentChar === SPACE2 || currentChar === LINE_BREAK2 || currentChar === TAB2)) {
          continue;
        }
        if (buffer === "") bufferStart = i;
        buffer += String.fromCharCode(currentChar);
      }
    }
    if (buffer.charCodeAt(0) === AT_SIGN) {
      let node2 = parseAtRule(buffer);
      if (source) {
        node2.src = [source, bufferStart, input.length];
        node2.dst = [source, bufferStart, input.length];
      }
      ast.push(node2);
    }
    if (closingBracketStack3.length > 0 && parent) {
      if (parent.kind === "rule") {
        throw new CssSyntaxError(
          `Missing closing } at ${parent.selector}`,
          parent.src ? [parent.src[0], parent.src[1], parent.src[1]] : null
        );
      }
      if (parent.kind === "at-rule") {
        throw new CssSyntaxError(
          `Missing closing } at ${parent.name} ${parent.params}`,
          parent.src ? [parent.src[0], parent.src[1], parent.src[1]] : null
        );
      }
    }
    if (licenseComments.length > 0) {
      return licenseComments.concat(ast);
    }
    return ast;
  }
  function parseAtRule(buffer, nodes = []) {
    let name = buffer;
    let params = "";
    for (let i = 5; i < buffer.length; i++) {
      let currentChar = buffer.charCodeAt(i);
      if (currentChar === SPACE2 || currentChar === TAB2 || currentChar === OPEN_PAREN2) {
        name = buffer.slice(0, i);
        params = buffer.slice(i);
        break;
      }
    }
    return atRule(name.trim(), params.trim(), nodes);
  }
  function parseDeclaration(buffer, colonIdx = buffer.indexOf(":")) {
    if (colonIdx === -1) return null;
    let importantIdx = buffer.indexOf("!important", colonIdx + 1);
    return decl(
      buffer.slice(0, colonIdx).trim(),
      buffer.slice(colonIdx + 1, importantIdx === -1 ? buffer.length : importantIdx).trim(),
      importantIdx !== -1
    );
  }
  function parseString(input, startIdx, quoteChar, source = null) {
    let peekChar;
    for (let i = startIdx + 1; i < input.length; i++) {
      peekChar = input.charCodeAt(i);
      if (peekChar === BACKSLASH2) {
        i += 1;
      } else if (peekChar === quoteChar) {
        return i;
      } else if (peekChar === SEMICOLON && (input.charCodeAt(i + 1) === LINE_BREAK2 || input.charCodeAt(i + 1) === CARRIAGE_RETURN && input.charCodeAt(i + 2) === LINE_BREAK2)) {
        throw new CssSyntaxError(
          `Unterminated string: ${input.slice(startIdx, i + 1) + String.fromCharCode(quoteChar)}`,
          source ? [source, startIdx, i + 1] : null
        );
      } else if (peekChar === LINE_BREAK2 || peekChar === CARRIAGE_RETURN && input.charCodeAt(i + 1) === LINE_BREAK2) {
        throw new CssSyntaxError(
          `Unterminated string: ${input.slice(startIdx, i) + String.fromCharCode(quoteChar)}`,
          source ? [source, startIdx, i + 1] : null
        );
      }
    }
    return startIdx;
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/escape.ts
  function escape(value2) {
    if (arguments.length === 0) {
      throw new TypeError("`CSS.escape` requires an argument.");
    }
    let string = String(value2);
    let length = string.length;
    let index = -1;
    let codeUnit;
    let result = "";
    let firstCodeUnit = string.charCodeAt(0);
    if (
      // If the character is the first character and is a `-` (U+002D), and
      // there is no second character, […]
      length === 1 && firstCodeUnit === 45
    ) {
      return "\\" + string;
    }
    while (++index < length) {
      codeUnit = string.charCodeAt(index);
      if (codeUnit === 0) {
        result += "\uFFFD";
        continue;
      }
      if (
        // If the character is in the range [\1-\1F] (U+0001 to U+001F) or is
        // U+007F, […]
        codeUnit >= 1 && codeUnit <= 31 || codeUnit === 127 || // If the character is the first character and is in the range [0-9]
        // (U+0030 to U+0039), […]
        index === 0 && codeUnit >= 48 && codeUnit <= 57 || // If the character is the second character and is in the range [0-9]
        // (U+0030 to U+0039) and the first character is a `-` (U+002D), […]
        index === 1 && codeUnit >= 48 && codeUnit <= 57 && firstCodeUnit === 45
      ) {
        result += "\\" + codeUnit.toString(16) + " ";
        continue;
      }
      if (codeUnit >= 128 || codeUnit === 45 || codeUnit === 95 || codeUnit >= 48 && codeUnit <= 57 || codeUnit >= 65 && codeUnit <= 90 || codeUnit >= 97 && codeUnit <= 122) {
        result += string.charAt(index);
        continue;
      }
      result += "\\" + string.charAt(index);
    }
    return result;
  }
  function unescape(escaped) {
    return escaped.replace(/\\([\dA-Fa-f]{1,6}[\t\n\f\r ]?|[\S\s])/g, (match) => {
      if (match.length <= 2) {
        return match[1];
      }
      let codePoint = Number.parseInt(match.slice(1).trim(), 16);
      if (
        // Invalid codepoint: https://infra.spec.whatwg.org/#code-point
        codePoint === 0 || codePoint > 1114111 || // Is surrogate: https://infra.spec.whatwg.org/#leading-surrogate
        //  - A leading surrogate is a code point that is in the range U+D800 to U+DBFF, inclusive.
        //  - A trailing surrogate is a code point that is in the range U+DC00 to U+DFFF, inclusive.
        codePoint >= 55296 && codePoint <= 57343
      ) {
        return "\uFFFD";
      }
      return String.fromCodePoint(codePoint);
    });
  }

  // ../tailwindcss/packages/tailwindcss/src/theme.ts
  var ignoredThemeKeyMap = /* @__PURE__ */ new Map([
    ["--font", ["--font-weight", "--font-size"]],
    ["--inset", ["--inset-shadow", "--inset-ring"]],
    [
      "--text",
      [
        "--text-color",
        "--text-decoration-color",
        "--text-decoration-thickness",
        "--text-indent",
        "--text-shadow",
        "--text-underline-offset"
      ]
    ],
    ["--grid-column", ["--grid-column-start", "--grid-column-end"]],
    ["--grid-row", ["--grid-row-start", "--grid-row-end"]]
  ]);
  function isIgnoredThemeKey(themeKey, namespace) {
    return (ignoredThemeKeyMap.get(namespace) ?? []).some(
      (ignoredThemeKey) => themeKey === ignoredThemeKey || themeKey.startsWith(`${ignoredThemeKey}-`)
    );
  }
  var Theme = class {
    constructor(values = /* @__PURE__ */ new Map(), keyframes = /* @__PURE__ */ new Set([])) {
      this.values = values;
      this.keyframes = keyframes;
    }
    values;
    keyframes;
    prefix = null;
    get size() {
      return this.values.size;
    }
    add(key, value2, options = 0 /* NONE */, src) {
      if (key.endsWith("-*")) {
        if (value2 !== "initial") {
          throw new Error(`Invalid theme value \`${value2}\` for namespace \`${key}\``);
        }
        if (key === "--*") {
          this.values.clear();
        } else {
          this.clearNamespace(
            key.slice(0, -2),
            // `--${key}-*: initial;` should clear _all_ theme values
            0 /* NONE */
          );
        }
      }
      if (options & 4 /* DEFAULT */) {
        let existing = this.values.get(key);
        if (existing && !(existing.options & 4 /* DEFAULT */)) return;
      }
      if (value2 === "initial") {
        this.values.delete(key);
      } else {
        this.values.set(key, { value: value2, options, src });
      }
    }
    keysInNamespaces(themeKeys) {
      let keys = [];
      for (let namespace of themeKeys) {
        let prefix = `${namespace}-`;
        for (let key of this.values.keys()) {
          if (!key.startsWith(prefix)) continue;
          if (key.indexOf("--", 2) !== -1) continue;
          if (isIgnoredThemeKey(key, namespace)) {
            continue;
          }
          keys.push(key.slice(prefix.length));
        }
      }
      return keys;
    }
    get(themeKeys) {
      for (let key of themeKeys) {
        let value2 = this.values.get(key);
        if (value2) {
          return value2.value;
        }
      }
      return null;
    }
    hasDefault(key) {
      return (this.getOptions(key) & 4 /* DEFAULT */) === 4 /* DEFAULT */;
    }
    getOptions(key) {
      key = unescape(this.#unprefixKey(key));
      return this.values.get(key)?.options ?? 0 /* NONE */;
    }
    entries() {
      if (!this.prefix) return this.values.entries();
      return Array.from(this.values, (entry) => {
        entry[0] = this.prefixKey(entry[0]);
        return entry;
      });
    }
    prefixKey(key) {
      if (!this.prefix) return key;
      return `--${this.prefix}-${key.slice(2)}`;
    }
    #unprefixKey(key) {
      if (!this.prefix) return key;
      return `--${key.slice(3 + this.prefix.length)}`;
    }
    clearNamespace(namespace, clearOptions) {
      let ignored = ignoredThemeKeyMap.get(namespace) ?? [];
      outer: for (let key of this.values.keys()) {
        if (key.startsWith(namespace)) {
          if (clearOptions !== 0 /* NONE */) {
            let options = this.getOptions(key);
            if ((options & clearOptions) !== clearOptions) {
              continue;
            }
          }
          for (let ignoredNamespace of ignored) {
            if (key.startsWith(ignoredNamespace)) continue outer;
          }
          this.values.delete(key);
        }
      }
    }
    #resolveKey(candidateValue, themeKeys) {
      for (let namespace of themeKeys) {
        let themeKey = candidateValue !== null ? `${namespace}-${candidateValue}` : namespace;
        if (!this.values.has(themeKey)) {
          if (candidateValue !== null && candidateValue.includes(".")) {
            themeKey = `${namespace}-${candidateValue.replaceAll(".", "_")}`;
            if (!this.values.has(themeKey)) continue;
          } else {
            continue;
          }
        }
        if (isIgnoredThemeKey(themeKey, namespace)) continue;
        return themeKey;
      }
      return null;
    }
    #var(themeKey) {
      let value2 = this.values.get(themeKey);
      if (!value2) {
        return null;
      }
      let fallback = null;
      if (value2.options & 2 /* REFERENCE */) {
        fallback = value2.value;
      }
      return `var(${escape(this.prefixKey(themeKey))}${fallback ? `, ${fallback}` : ""})`;
    }
    markUsedVariable(themeKey) {
      let key = unescape(this.#unprefixKey(themeKey));
      let value2 = this.values.get(key);
      if (!value2) return false;
      let isUsed = value2.options & 16 /* USED */;
      value2.options |= 16 /* USED */;
      return !isUsed;
    }
    resolve(candidateValue, themeKeys, options = 0 /* NONE */) {
      let themeKey = this.#resolveKey(candidateValue, themeKeys);
      if (!themeKey) return null;
      let value2 = this.values.get(themeKey);
      if ((options | value2.options) & 1 /* INLINE */) {
        return value2.value;
      }
      return this.#var(themeKey);
    }
    resolveValue(candidateValue, themeKeys) {
      let themeKey = this.#resolveKey(candidateValue, themeKeys);
      if (!themeKey) return null;
      return this.values.get(themeKey).value;
    }
    resolveWith(candidateValue, themeKeys, nestedKeys = []) {
      let themeKey = this.#resolveKey(candidateValue, themeKeys);
      if (!themeKey) return null;
      let extra = {};
      for (let name of nestedKeys) {
        let nestedKey = `${themeKey}${name}`;
        let nestedValue = this.values.get(nestedKey);
        if (!nestedValue) continue;
        if (nestedValue.options & 1 /* INLINE */) {
          extra[name] = nestedValue.value;
        } else {
          extra[name] = this.#var(nestedKey);
        }
      }
      let value2 = this.values.get(themeKey);
      if (value2.options & 1 /* INLINE */) {
        return [value2.value, extra];
      }
      return [this.#var(themeKey), extra];
    }
    namespace(namespace) {
      let values = /* @__PURE__ */ new Map();
      let prefix = `${namespace}-`;
      for (let [key, value2] of this.values) {
        if (key === namespace) {
          values.set(null, value2.value);
        } else if (key.startsWith(`${prefix}-`)) {
          values.set(key.slice(namespace.length), value2.value);
        } else if (key.startsWith(prefix)) {
          values.set(key.slice(prefix.length), value2.value);
        }
      }
      return values;
    }
    addKeyframes(value2) {
      this.keyframes.add(value2);
    }
    getKeyframes() {
      return Array.from(this.keyframes);
    }
  };

  // ../tailwindcss/packages/tailwindcss/src/utils/default-map.ts
  var DefaultMap = class extends Map {
    constructor(factory) {
      super();
      this.factory = factory;
    }
    factory;
    get(key) {
      let value2 = super.get(key);
      if (value2 === void 0) {
        value2 = this.factory(key, this);
        this.set(key, value2);
      }
      return value2;
    }
  };

  // ../tailwindcss/packages/tailwindcss/src/utils/segment.ts
  var BACKSLASH3 = 92;
  var OPEN_CURLY2 = 123;
  var CLOSE_CURLY2 = 125;
  var OPEN_PAREN3 = 40;
  var CLOSE_PAREN3 = 41;
  var OPEN_BRACKET3 = 91;
  var CLOSE_BRACKET3 = 93;
  var DOUBLE_QUOTE3 = 34;
  var SINGLE_QUOTE3 = 39;
  var closingBracketStack = new Uint8Array(256);
  function segment(input, separator2) {
    let stackPos = 0;
    let parts = [];
    let lastPos = 0;
    let len = input.length;
    let separatorCode = separator2.charCodeAt(0);
    for (let idx = 0; idx < len; idx++) {
      let char = input.charCodeAt(idx);
      if (stackPos === 0 && char === separatorCode) {
        parts.push(input.slice(lastPos, idx));
        lastPos = idx + 1;
        continue;
      }
      switch (char) {
        case BACKSLASH3:
          idx += 1;
          break;
        // Strings should be handled as-is until the end of the string. No need to
        // worry about balancing parens, brackets, or curlies inside a string.
        case SINGLE_QUOTE3:
        case DOUBLE_QUOTE3:
          while (++idx < len) {
            let nextChar = input.charCodeAt(idx);
            if (nextChar === BACKSLASH3) {
              idx += 1;
              continue;
            }
            if (nextChar === char) {
              break;
            }
          }
          break;
        case OPEN_PAREN3:
          closingBracketStack[stackPos] = CLOSE_PAREN3;
          stackPos++;
          break;
        case OPEN_BRACKET3:
          closingBracketStack[stackPos] = CLOSE_BRACKET3;
          stackPos++;
          break;
        case OPEN_CURLY2:
          closingBracketStack[stackPos] = CLOSE_CURLY2;
          stackPos++;
          break;
        case CLOSE_BRACKET3:
        case CLOSE_CURLY2:
        case CLOSE_PAREN3:
          if (stackPos > 0 && char === closingBracketStack[stackPos - 1]) {
            stackPos--;
          }
          break;
      }
    }
    parts.push(input.slice(lastPos));
    return parts;
  }

  // ../tailwindcss/packages/tailwindcss/src/value-parser.ts
  function word(value2) {
    return {
      kind: "word",
      value: value2
    };
  }
  function fun2(value2, nodes) {
    return {
      kind: "function",
      value: value2,
      nodes
    };
  }
  function separator(value2) {
    return {
      kind: "separator",
      value: value2
    };
  }
  function toCss2(ast) {
    let css = "";
    for (const node of ast) {
      switch (node.kind) {
        case "word":
        case "separator": {
          css += node.value;
          break;
        }
        case "function": {
          css += node.value + "(" + toCss2(node.nodes) + ")";
        }
      }
    }
    return css;
  }
  var BACKSLASH4 = 92;
  var CLOSE_PAREN4 = 41;
  var COLON3 = 58;
  var COMMA2 = 44;
  var DOUBLE_QUOTE4 = 34;
  var EQUALS = 61;
  var GREATER_THAN2 = 62;
  var LESS_THAN = 60;
  var NEWLINE2 = 10;
  var OPEN_PAREN4 = 40;
  var SINGLE_QUOTE4 = 39;
  var SLASH2 = 47;
  var SPACE3 = 32;
  var TAB3 = 9;
  function parse3(input) {
    input = input.replaceAll("\r\n", "\n");
    let ast = [];
    let stack = [];
    let parent = null;
    let buffer = "";
    let peekChar;
    for (let i = 0; i < input.length; i++) {
      let currentChar = input.charCodeAt(i);
      switch (currentChar) {
        // Current character is a `\` therefore the next character is escaped,
        // consume it together with the next character and continue.
        case BACKSLASH4: {
          buffer += input[i] + input[i + 1];
          i++;
          break;
        }
        // Typically for math operators, they have to have spaces around them. But
        // there are situations in `theme(colors.red.500/10)` where we use `/`
        // without spaces. Let's make sure this is a separate word as well.
        case SLASH2: {
          if (buffer.length > 0) {
            let node2 = word(buffer);
            if (parent) {
              parent.nodes.push(node2);
            } else {
              ast.push(node2);
            }
            buffer = "";
          }
          let node = word(input[i]);
          if (parent) {
            parent.nodes.push(node);
          } else {
            ast.push(node);
          }
          break;
        }
        // Space and commas are bundled into separators
        //
        // E.g.:
        //
        // ```css
        // foo(bar, baz)
        //        ^^
        // ```
        case COLON3:
        case COMMA2:
        case EQUALS:
        case GREATER_THAN2:
        case LESS_THAN:
        case NEWLINE2:
        case SPACE3:
        case TAB3: {
          if (buffer.length > 0) {
            let node2 = word(buffer);
            if (parent) {
              parent.nodes.push(node2);
            } else {
              ast.push(node2);
            }
            buffer = "";
          }
          let start = i;
          let end = i + 1;
          for (; end < input.length; end++) {
            peekChar = input.charCodeAt(end);
            if (peekChar !== COLON3 && peekChar !== COMMA2 && peekChar !== EQUALS && peekChar !== GREATER_THAN2 && peekChar !== LESS_THAN && peekChar !== NEWLINE2 && peekChar !== SPACE3 && peekChar !== TAB3) {
              break;
            }
          }
          i = end - 1;
          let node = separator(input.slice(start, end));
          if (parent) {
            parent.nodes.push(node);
          } else {
            ast.push(node);
          }
          break;
        }
        // Start of a string.
        case SINGLE_QUOTE4:
        case DOUBLE_QUOTE4: {
          let start = i;
          for (let j = i + 1; j < input.length; j++) {
            peekChar = input.charCodeAt(j);
            if (peekChar === BACKSLASH4) {
              j += 1;
            } else if (peekChar === currentChar) {
              i = j;
              break;
            }
          }
          buffer += input.slice(start, i + 1);
          break;
        }
        // Start of a function call.
        //
        // E.g.:
        //
        // ```css
        // foo(bar, baz)
        //    ^
        // ```
        case OPEN_PAREN4: {
          let node = fun2(buffer, []);
          buffer = "";
          if (parent) {
            parent.nodes.push(node);
          } else {
            ast.push(node);
          }
          stack.push(node);
          parent = node;
          break;
        }
        // End of a function call.
        //
        // E.g.:
        //
        // ```css
        // foo(bar, baz)
        //             ^
        // ```
        case CLOSE_PAREN4: {
          let tail = stack.pop();
          if (buffer.length > 0) {
            let node = word(buffer);
            tail?.nodes.push(node);
            buffer = "";
          }
          if (stack.length > 0) {
            parent = stack[stack.length - 1];
          } else {
            parent = null;
          }
          break;
        }
        // Everything else will be collected in the buffer
        default: {
          buffer += String.fromCharCode(currentChar);
        }
      }
    }
    if (buffer.length > 0) {
      ast.push(word(buffer));
    }
    return ast;
  }

  // ../tailwindcss/packages/tailwindcss/src/walk.ts
  var WalkKind = /* @__PURE__ */ ((WalkKind2) => {
    WalkKind2[WalkKind2["Continue"] = 0] = "Continue";
    WalkKind2[WalkKind2["Skip"] = 1] = "Skip";
    WalkKind2[WalkKind2["Stop"] = 2] = "Stop";
    WalkKind2[WalkKind2["Replace"] = 3] = "Replace";
    WalkKind2[WalkKind2["ReplaceSkip"] = 4] = "ReplaceSkip";
    WalkKind2[WalkKind2["ReplaceStop"] = 5] = "ReplaceStop";
    return WalkKind2;
  })(WalkKind || {});
  var WalkAction = {
    Continue: { kind: 0 /* Continue */ },
    Skip: { kind: 1 /* Skip */ },
    Stop: { kind: 2 /* Stop */ },
    Replace: (nodes) => ({ kind: 3 /* Replace */, nodes: Array.isArray(nodes) ? nodes : [nodes] }),
    ReplaceSkip: (nodes) => ({ kind: 4 /* ReplaceSkip */, nodes: Array.isArray(nodes) ? nodes : [nodes] }),
    ReplaceStop: (nodes) => ({ kind: 5 /* ReplaceStop */, nodes: Array.isArray(nodes) ? nodes : [nodes] })
  };
  function walk(ast, hooks) {
    if (typeof hooks === "function") walkImplementation(ast, hooks);
    else walkImplementation(ast, hooks.enter, hooks.exit);
  }
  function walkImplementation(ast, enter = () => WalkAction.Continue, exit = () => WalkAction.Continue) {
    let stack = { value: [ast, 0, null], prev: null };
    let ctx = {
      parent: null,
      depth: 0,
      index: 0,
      siblings: ast,
      path() {
        let path = [];
        let frames = stack;
        while (frames) {
          let parent = frames.value[2];
          if (parent) path.push(parent);
          frames = frames.prev;
        }
        path.reverse();
        return path;
      }
    };
    while (stack !== null) {
      let frame = stack.value;
      let nodes = frame[0];
      let offset = frame[1];
      let parent = frame[2];
      if (offset >= nodes.length) {
        stack = stack.prev;
        ctx.depth -= 1;
        continue;
      }
      ctx.parent = parent;
      ctx.siblings = nodes;
      if (offset >= 0) {
        ctx.index = offset;
        let node2 = nodes[offset];
        let result2 = enter(node2, ctx) ?? WalkAction.Continue;
        switch (result2.kind) {
          case 0 /* Continue */: {
            if (node2.nodes && node2.nodes.length > 0) {
              ctx.depth += 1;
              stack = {
                value: [node2.nodes, 0, node2],
                prev: stack
              };
            }
            frame[1] = ~offset;
            continue;
          }
          case 2 /* Stop */:
            return;
          // Stop immediately
          case 1 /* Skip */: {
            frame[1] = ~offset;
            continue;
          }
          case 3 /* Replace */: {
            nodes.splice(offset, 1, ...result2.nodes);
            continue;
          }
          case 5 /* ReplaceStop */: {
            nodes.splice(offset, 1, ...result2.nodes);
            return;
          }
          case 4 /* ReplaceSkip */: {
            nodes.splice(offset, 1, ...result2.nodes);
            frame[1] += result2.nodes.length;
            continue;
          }
          default: {
            result2;
            throw new Error(
              // @ts-expect-error enterResult.kind may be invalid
              `Invalid \`WalkAction.${WalkKind[result2.kind] ?? `Unknown(${result2.kind})`}\` in enter.`
            );
          }
        }
      }
      let index = ~offset;
      ctx.index = index;
      let node = nodes[index];
      let result = exit(node, ctx) ?? WalkAction.Continue;
      switch (result.kind) {
        case 0 /* Continue */:
          frame[1] = index + 1;
          continue;
        case 2 /* Stop */:
          return;
        // Stop immediately
        case 3 /* Replace */: {
          nodes.splice(index, 1, ...result.nodes);
          frame[1] = index + result.nodes.length;
          continue;
        }
        case 5 /* ReplaceStop */: {
          nodes.splice(index, 1, ...result.nodes);
          return;
        }
        case 4 /* ReplaceSkip */: {
          nodes.splice(index, 1, ...result.nodes);
          frame[1] = index + result.nodes.length;
          continue;
        }
        default: {
          result;
          throw new Error(
            // @ts-expect-error `result.kind` could still be filled with an invalid value
            `Invalid \`WalkAction.${WalkKind[result.kind] ?? `Unknown(${result.kind})`}\` in exit.`
          );
        }
      }
    }
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/variables.ts
  var extractUsedVariablesCache = new DefaultMap((raw) => {
    let variables = [];
    walk(parse3(raw), (node) => {
      if (node.kind !== "function" || node.value !== "var") return;
      walk(node.nodes, (child) => {
        if (child.kind !== "word" || child.value[0] !== "-" || child.value[1] !== "-") return;
        variables.push(child.value);
      });
      return WalkAction.Skip;
    });
    return variables;
  });
  function extractUsedVariables(raw) {
    return extractUsedVariablesCache.get(raw);
  }

  // ../tailwindcss/packages/tailwindcss/src/ast.ts
  var AT_SIGN2 = 64;
  var PIPE = 124;
  function styleRule(selector2, nodes = []) {
    return {
      kind: "rule",
      selector: selector2,
      nodes
    };
  }
  function atRule(name, params = "", nodes = []) {
    return {
      kind: "at-rule",
      name,
      params,
      nodes
    };
  }
  function rule(selector2, nodes = []) {
    if (selector2.charCodeAt(0) === AT_SIGN2) {
      return parseAtRule(selector2, nodes);
    }
    return styleRule(selector2, nodes);
  }
  function decl(property2, value2, important = false) {
    return {
      kind: "declaration",
      property: property2,
      value: value2,
      important
    };
  }
  function comment(value2) {
    return {
      kind: "comment",
      value: value2
    };
  }
  function context(context2, nodes) {
    return {
      kind: "context",
      context: context2,
      nodes
    };
  }
  function atRoot(nodes) {
    return {
      kind: "at-root",
      nodes
    };
  }
  function cloneAstNode(node) {
    switch (node.kind) {
      case "rule":
        return {
          kind: node.kind,
          selector: node.selector,
          nodes: node.nodes.map(cloneAstNode),
          src: node.src,
          dst: node.dst
        };
      case "at-rule":
        return {
          kind: node.kind,
          name: node.name,
          params: node.params,
          nodes: node.nodes.map(cloneAstNode),
          src: node.src,
          dst: node.dst
        };
      case "at-root":
        return {
          kind: node.kind,
          nodes: node.nodes.map(cloneAstNode),
          src: node.src,
          dst: node.dst
        };
      case "context":
        return {
          kind: node.kind,
          context: { ...node.context },
          nodes: node.nodes.map(cloneAstNode),
          src: node.src,
          dst: node.dst
        };
      case "declaration":
        return {
          kind: node.kind,
          property: node.property,
          value: node.value,
          important: node.important,
          src: node.src,
          dst: node.dst
        };
      case "comment":
        return {
          kind: node.kind,
          value: node.value,
          src: node.src,
          dst: node.dst
        };
      default:
        node;
        throw new Error(`Unknown node kind: ${node.kind}`);
    }
  }
  function cssContext(ctx) {
    return {
      depth: ctx.depth,
      index: ctx.index,
      siblings: ctx.siblings,
      get context() {
        let context2 = {};
        for (let child of ctx.path()) {
          if (child.kind === "context") {
            Object.assign(context2, child.context);
          }
        }
        Object.defineProperty(this, "context", { value: context2 });
        return context2;
      },
      get parent() {
        let parent = this.path().pop() ?? null;
        Object.defineProperty(this, "parent", { value: parent });
        return parent;
      },
      path() {
        return ctx.path().filter((n) => n.kind !== "context");
      }
    };
  }
  function optimizeAst(ast, designSystem, polyfills = 3 /* All */) {
    let atRoots = [];
    let seenAtProperties = /* @__PURE__ */ new Set();
    let cssThemeVariables = new DefaultMap(() => /* @__PURE__ */ new Set());
    let colorMixDeclarations = new DefaultMap(() => /* @__PURE__ */ new Set());
    let keyframes = /* @__PURE__ */ new Set();
    let usedKeyframeNames = /* @__PURE__ */ new Set();
    let propertyFallbacksRoot = [];
    let propertyFallbacksUniversal = [];
    let variableDependencies = new DefaultMap(() => /* @__PURE__ */ new Set());
    function transform(node, parent, context2 = {}, depth = 0) {
      if (node.kind === "declaration") {
        if (node.property === "--tw-sort" || node.value === void 0 || node.value === null) {
          return;
        }
        if (context2.theme && node.property[0] === "-" && node.property[1] === "-") {
          if (node.value === "initial") {
            node.value = void 0;
            return;
          }
          if (!context2.keyframes) {
            cssThemeVariables.get(parent).add(node);
          }
        }
        if (node.value.includes("var(")) {
          if (context2.theme && node.property[0] === "-" && node.property[1] === "-") {
            for (let variable of extractUsedVariables(node.value)) {
              variableDependencies.get(variable).add(node.property);
            }
          } else {
            designSystem.trackUsedVariables(node.value);
          }
        }
        if (node.property === "animation") {
          for (let keyframeName of extractKeyframeNames(node.value)) {
            usedKeyframeNames.add(keyframeName);
          }
        }
        if (polyfills & 2 /* ColorMix */ && !context2.supportsColorMix && !context2.keyframes && node.value.includes("color-mix(")) {
          colorMixDeclarations.get(parent).add(node);
        }
        parent.push(node);
      } else if (node.kind === "rule") {
        let nodes = [];
        for (let child of node.nodes) {
          transform(child, nodes, context2, depth + 1);
        }
        if (nodes.length > 0) {
          parent.push({ ...node, nodes });
        }
      } else if (node.kind === "at-rule" && node.name === "@property" && depth === 0) {
        if (seenAtProperties.has(node.params)) {
          return;
        }
        if (polyfills & 1 /* AtProperty */) {
          let property2 = node.params;
          let initialValue = null;
          let inherits = false;
          for (let prop of node.nodes) {
            if (prop.kind !== "declaration") continue;
            if (prop.property === "initial-value") {
              initialValue = prop.value;
            } else if (prop.property === "inherits") {
              inherits = prop.value === "true";
            }
          }
          let fallback = decl(property2, initialValue ?? "initial");
          fallback.src = node.src;
          if (inherits) {
            propertyFallbacksRoot.push(fallback);
          } else {
            propertyFallbacksUniversal.push(fallback);
          }
        }
        seenAtProperties.add(node.params);
        let copy = { ...node, nodes: [] };
        for (let child of node.nodes) {
          transform(child, copy.nodes, context2, depth + 1);
        }
        parent.push(copy);
      } else if (node.kind === "at-rule") {
        if (node.name === "@keyframes") {
          context2 = { ...context2, keyframes: true };
        } else if (node.name === "@supports" && node.params.includes("color-mix(")) {
          context2 = { ...context2, supportsColorMix: true };
        }
        let copy = { ...node, nodes: [] };
        for (let child of node.nodes) {
          transform(child, copy.nodes, context2, depth + 1);
        }
        if (node.name === "@keyframes" && context2.theme) {
          keyframes.add(copy);
        }
        if (copy.nodes.length > 0 || copy.name === "@layer" || copy.name === "@charset" || copy.name === "@custom-media" || copy.name === "@namespace" || copy.name === "@import" || copy.name === "@apply") {
          parent.push(copy);
        }
      } else if (node.kind === "at-root") {
        for (let child of node.nodes) {
          let newParent = [];
          transform(child, newParent, context2, 0);
          for (let child2 of newParent) {
            atRoots.push(child2);
          }
        }
      } else if (node.kind === "context") {
        if (node.context.reference) {
          return;
        } else if (node.context.source) {
          let copy = { ...node, nodes: [] };
          for (let child of node.nodes) {
            transform(child, copy.nodes, { ...context2, ...node.context }, depth);
          }
          if (copy.nodes.length > 0) {
            parent.push(copy);
          }
        } else {
          for (let child of node.nodes) {
            transform(child, parent, { ...context2, ...node.context }, depth);
          }
        }
      } else if (node.kind === "comment") {
        parent.push(node);
      } else {
        node;
      }
    }
    let newAst = [];
    for (let node of ast) {
      transform(node, newAst, {}, 0);
    }
    next: for (let [parent, declarations] of cssThemeVariables) {
      for (let declaration of declarations) {
        let variableUsed = isVariableUsed(
          declaration.property,
          designSystem.theme,
          variableDependencies
        );
        if (variableUsed) {
          if (declaration.property.startsWith(designSystem.theme.prefixKey("--animate-"))) {
            for (let keyframeName of extractKeyframeNames(declaration.value))
              usedKeyframeNames.add(keyframeName);
          }
          continue;
        }
        let idx = parent.indexOf(declaration);
        parent.splice(idx, 1);
        if (parent.length === 0) {
          let path = findNode(newAst, (node) => node.kind === "rule" && node.nodes === parent);
          if (!path || path.length === 0) continue next;
          path.unshift({
            kind: "at-root",
            nodes: newAst
          });
          do {
            let nodeToRemove = path.pop();
            if (!nodeToRemove) break;
            let removeFrom = path[path.length - 1];
            if (!removeFrom) break;
            if (removeFrom.kind !== "at-root" && removeFrom.kind !== "at-rule") break;
            let idx2 = removeFrom.nodes.indexOf(nodeToRemove);
            if (idx2 === -1) break;
            removeFrom.nodes.splice(idx2, 1);
          } while (true);
          continue next;
        }
      }
    }
    for (let keyframe of keyframes) {
      if (!usedKeyframeNames.has(keyframe.params)) {
        let idx = atRoots.indexOf(keyframe);
        atRoots.splice(idx, 1);
      }
    }
    newAst = newAst.concat(atRoots);
    if (polyfills & 2 /* ColorMix */) {
      for (let [parent, declarations] of colorMixDeclarations) {
        for (let declaration of declarations) {
          let idx = parent.indexOf(declaration);
          if (idx === -1 || declaration.value == null) continue;
          let ast2 = parse3(declaration.value);
          let requiresPolyfill = false;
          walk(ast2, (node) => {
            if (node.kind !== "function" || node.value !== "color-mix") return;
            let containsUnresolvableVars = false;
            let containsCurrentcolor = false;
            walk(node.nodes, (node2) => {
              if (node2.kind == "word" && node2.value.toLowerCase() === "currentcolor") {
                containsCurrentcolor = true;
                requiresPolyfill = true;
                return;
              }
              let varNode = node2;
              let inlinedColor = null;
              let seenVariables = /* @__PURE__ */ new Set();
              do {
                if (varNode.kind !== "function" || varNode.value !== "var") return;
                let firstChild = varNode.nodes[0];
                if (!firstChild || firstChild.kind !== "word") return;
                let variableName = firstChild.value;
                if (seenVariables.has(variableName)) {
                  containsUnresolvableVars = true;
                  return;
                }
                seenVariables.add(variableName);
                requiresPolyfill = true;
                inlinedColor = designSystem.theme.resolveValue(null, [firstChild.value]);
                if (!inlinedColor) {
                  containsUnresolvableVars = true;
                  return;
                }
                if (inlinedColor.toLowerCase() === "currentcolor") {
                  containsCurrentcolor = true;
                  return;
                }
                if (inlinedColor.startsWith("var(")) {
                  let subAst = parse3(inlinedColor);
                  varNode = subAst[0];
                } else {
                  varNode = null;
                }
              } while (varNode);
              return WalkAction.Replace({ kind: "word", value: inlinedColor });
            });
            if (containsUnresolvableVars || containsCurrentcolor) {
              let separatorIndex = node.nodes.findIndex(
                (node2) => node2.kind === "separator" && node2.value.trim().includes(",")
              );
              if (separatorIndex === -1) return;
              let firstColorValue = node.nodes.length > separatorIndex ? node.nodes[separatorIndex + 1] : null;
              if (!firstColorValue) return;
              return WalkAction.Replace(firstColorValue);
            } else if (requiresPolyfill) {
              let colorspace = node.nodes[2];
              if (colorspace.kind === "word" && (colorspace.value === "oklab" || colorspace.value === "oklch" || colorspace.value === "lab" || colorspace.value === "lch")) {
                colorspace.value = "srgb";
              }
            }
          });
          if (!requiresPolyfill) continue;
          let fallback = {
            ...declaration,
            value: toCss2(ast2)
          };
          let colorMixQuery = rule("@supports (color: color-mix(in lab, red, red))", [declaration]);
          colorMixQuery.src = declaration.src;
          parent.splice(idx, 1, fallback, colorMixQuery);
        }
      }
    }
    if (polyfills & 1 /* AtProperty */) {
      let fallbackAst = [];
      if (propertyFallbacksRoot.length > 0) {
        let wrapper = rule(":root, :host", propertyFallbacksRoot);
        wrapper.src = propertyFallbacksRoot[0].src;
        fallbackAst.push(wrapper);
      }
      if (propertyFallbacksUniversal.length > 0) {
        let wrapper = rule("*, ::before, ::after, ::backdrop", propertyFallbacksUniversal);
        wrapper.src = propertyFallbacksUniversal[0].src;
        fallbackAst.push(wrapper);
      }
      if (fallbackAst.length > 0) {
        let firstValidNodeIndex = newAst.findIndex((node) => {
          if (node.kind === "comment") return false;
          if (node.kind === "at-rule") {
            if (node.name === "@charset") return false;
            if (node.name === "@import") return false;
          }
          return true;
        });
        let layerPropertiesStatement = atRule("@layer", "properties", []);
        layerPropertiesStatement.src = fallbackAst[0].src;
        newAst.splice(
          firstValidNodeIndex < 0 ? newAst.length : firstValidNodeIndex,
          0,
          layerPropertiesStatement
        );
        let block = rule("@layer properties", [
          atRule(
            "@supports",
            // We can't write a supports query for `@property` directly so we have to test for
            // features that are added around the same time in Mozilla and Safari.
            "((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b))))",
            fallbackAst
          )
        ]);
        block.src = fallbackAst[0].src;
        block.nodes[0].src = fallbackAst[0].src;
        newAst.push(block);
      }
    }
    return handleNesting(newAst);
  }
  function handleNesting(ast) {
    let parseSelectorCache = new DefaultMap(parse);
    let containsAtScope = /* @__PURE__ */ new Set();
    {
      let scan2 = function(nodes2) {
        let found = false;
        for (let node of nodes2) {
          if (node.kind === "declaration" || node.kind === "comment") continue;
          if (scan2(node.nodes) || node.kind === "at-rule" && node.name === "@scope") {
            containsAtScope.add(node);
            found = true;
          }
        }
        return found;
      };
      var scan = scan2;
      scan2(ast);
    }
    let selectorStack = [];
    let atRuleStack = [];
    let nodes = null;
    let seenDeclarationProperties = /* @__PURE__ */ new Set();
    let dedupeDeclarationsInNodes = /* @__PURE__ */ new Set();
    let result = [];
    let skipExit = /* @__PURE__ */ new Set();
    let sourceStack = [];
    let maskedSelectorStacks = /* @__PURE__ */ new Map();
    walk(ast, {
      enter(node) {
        switch (node.kind) {
          case "rule": {
            nodes = null;
            if (selectorStack.length === 0) {
              if (node.selector.includes("&")) {
                let replacement = atRuleStack.some(([name]) => name === "@scope") ? ":where(:scope)" : ":scope";
                let ast2 = parse(node.selector);
                let changed = false;
                walk(ast2, (node2) => {
                  if (node2.kind === "selector" && node2.value === "&") {
                    changed = true;
                    node2.value = replacement;
                  }
                });
                if (changed) {
                  selectorStack.push([toCss(ast2), node.src, node.dst]);
                } else {
                  selectorStack.push([node.selector, node.src, node.dst]);
                }
              } else {
                selectorStack.push([node.selector, node.src, node.dst]);
              }
            } else {
              if (node.selector === "&") {
                skipExit.add(node);
                return;
              }
              let lastSelector = selectorStack[selectorStack.length - 1][0];
              let selector2 = segment(node.selector, ",").map((selector3) => substituteNestingSelector(selector3, lastSelector)).join(", ");
              selectorStack.push([selector2, node.src, node.dst]);
            }
            if (node.nodes.some((child) => child.kind === "declaration") && !containsAtScope.has(node)) {
              for (let child of node.nodes) emit(child);
              return WalkAction.Skip;
            }
            break;
          }
          case "at-rule": {
            nodes = null;
            if (node.nodes.length === 0 && !DROPPABLE_IF_EMPTY_AT_RULES.has(node.name)) {
              emit(node);
              skipExit.add(node);
              return WalkAction.Skip;
            } else if (HOISTABLE_AT_RULES.has(node.name)) {
              let params = node.params;
              if (node.name === "@scope") {
                let isVariant = sourceStack[sourceStack.length - 1] === "variant";
                let hasParent = selectorStack.length > 0;
                {
                  let queue = [node];
                  for (let parent of queue) {
                    let newNodes = [];
                    let group = null;
                    for (let child of parent.nodes) {
                      if (child.kind === "context") queue.push(child);
                      if (child.kind === "declaration" || child.kind === "comment") {
                        if (group === null) {
                          group = [];
                          newNodes.push(styleRule("&", group));
                        }
                        group.push(child);
                      } else {
                        group = null;
                        newNodes.push(child);
                      }
                    }
                    parent.nodes = newNodes;
                  }
                }
                if (params.includes("&") || !isVariant && hasParent) {
                  let parentSelector = hasParent ? selectorStack[selectorStack.length - 1][0] : null;
                  let paramsAst = parse3(params);
                  let isScopeEnd = false;
                  let consumedParent = false;
                  for (let paramNode of paramsAst) {
                    if (paramNode.kind === "word" && paramNode.value === "to") {
                      isScopeEnd = true;
                      continue;
                    }
                    if (paramNode.kind !== "function" || paramNode.value !== "") continue;
                    let selector2 = toCss2(paramNode.nodes);
                    if (!isScopeEnd && !isVariant && parentSelector !== null) {
                      paramNode.nodes = [
                        word(
                          segment(selector2, ",").map((part) => substituteNestingSelector(part.trim(), parentSelector)).join(", ")
                        )
                      ];
                      consumedParent = true;
                    } else if (selector2.includes("&")) {
                      let replacement = isScopeEnd ? ":where(:scope)" : parentSelector ?? ":scope";
                      paramNode.nodes = [
                        word(substituteNestingSelector(selector2, replacement))
                      ];
                      if (!isScopeEnd && hasParent) consumedParent = true;
                    }
                  }
                  params = toCss2(paramsAst);
                  if (consumedParent) {
                    maskedSelectorStacks.set(node, selectorStack);
                    selectorStack = [];
                  }
                }
              }
              atRuleStack.push([node.name, params, node.src, node.dst]);
            } else {
              emit(node);
              skipExit.add(node);
              return WalkAction.Skip;
            }
            break;
          }
          case "declaration":
          case "comment": {
            emit(node);
            break;
          }
          case "context":
            if (node.context.source) sourceStack.push(node.context.source);
            break;
          case "at-root":
            break;
          default:
            node;
            break;
        }
      },
      exit(node) {
        if (skipExit.delete(node)) return;
        switch (node.kind) {
          case "rule": {
            nodes = null;
            selectorStack.pop();
            break;
          }
          case "at-rule": {
            nodes = null;
            atRuleStack.pop();
            let maskedSelectorStack = maskedSelectorStacks.get(node);
            if (maskedSelectorStack) {
              selectorStack = maskedSelectorStack;
              maskedSelectorStacks.delete(node);
            }
            break;
          }
          case "context":
            if (node.context.source) sourceStack.pop();
            break;
          case "declaration":
          case "comment":
          case "at-root":
            break;
          default:
            node;
            break;
        }
      }
    });
    {
      for (let nodes2 of dedupeDeclarationsInNodes) {
        let seen = /* @__PURE__ */ new Set();
        for (let i = nodes2.length - 1; i >= 0; --i) {
          let node = nodes2[i];
          if (node.kind !== "declaration") continue;
          let id = `${node.property}\0${node.value}\0${node.important}`;
          if (seen.has(id)) nodes2.splice(i, 1);
          else seen.add(id);
        }
      }
    }
    return result;
    function emit(node) {
      if (nodes) {
        if (node.kind === "declaration") {
          if (seenDeclarationProperties.has(node.property)) {
            dedupeDeclarationsInNodes.add(nodes);
          } else {
            seenDeclarationProperties.add(node.property);
          }
        }
        nodes.push(node);
        return;
      }
      {
        if (selectorStack.length === 0 && atRuleStack.length === 0) {
          let target2 = result;
          let lastNode = target2[target2.length - 1];
          if (lastNode && lastNode.kind === "at-rule" && node.kind === "at-rule" && lastNode.nodes.length === 0 && node.nodes.length === 0 && lastNode.name === node.name && lastNode.params === node.params) {
            return;
          }
          result.push(node);
          return;
        }
        {
          nodes = [node];
          seenDeclarationProperties.clear();
          if (node.kind === "declaration") {
            seenDeclarationProperties.add(node.property);
          }
        }
        let root = null;
        let target = result;
        let atRuleOffset = 0;
        {
          let lastNode = target[target.length - 1];
          if (lastNode && lastNode.kind === "at-rule") {
            for (let i = 0; i < atRuleStack.length; i++) {
              let atRule2 = atRuleStack[i];
              if (!lastNode) break;
              if (lastNode.kind !== "at-rule") break;
              if (lastNode.name !== atRule2[0]) break;
              if (lastNode.params !== atRule2[1]) break;
              atRuleOffset++;
              target = lastNode.nodes;
              lastNode = lastNode.nodes[lastNode.nodes.length - 1];
            }
          }
        }
        if (selectorStack.length > 0) {
          let [selector2, src, dst] = selectorStack[selectorStack.length - 1];
          if (atRuleStack.length - atRuleOffset <= 0) {
            let lastNode = target[target.length - 1];
            if (lastNode && lastNode.kind === "rule" && lastNode.selector === selector2) {
              lastNode.nodes.push(...nodes);
              nodes = lastNode.nodes;
              dedupeDeclarationsInNodes.add(nodes);
              return;
            }
          }
          root = rule(selector2, nodes);
          if (src || dst) Object.assign(root, { src, dst });
        }
        for (let i = atRuleStack.length - 1; i >= atRuleOffset; --i) {
          let [name, params, src, dst] = atRuleStack[i];
          root = atRule(name, params, root ? [root] : nodes);
          if (src || dst) Object.assign(root, { src, dst });
        }
        if (root) {
          target.push(root);
        } else {
          target.push(...nodes);
        }
      }
    }
    function substituteNestingSelector(selector2, parentSelector) {
      if (selector2.includes("&")) {
        let ast2 = parse(selector2);
        let changed = false;
        walk(ast2, {
          enter(node, ctx) {
            if (node.kind !== "selector" || node.value !== "&") return;
            changed = true;
            node.value = `:is(${parentSelector})`;
            if (ctx.parent === null) return;
            let parentAst2 = parseSelectorCache.get(parentSelector);
            if (parentAst2.length === 1 && parentAst2[0].kind === "list") {
              return;
            }
            if (ctx.parent.kind === "complex") {
              if (ctx.index === 0) {
                node.value = parentSelector;
                return;
              } else if (ctx.index === ctx.siblings.length - 1) {
                if (parentAst2[0].kind === "complex") {
                  return;
                }
                node.value = parentSelector;
                return;
              } else {
                if (parentAst2[0].kind === "complex") {
                  return;
                }
                node.value = parentSelector;
                return;
              }
            } else if (ctx.parent.kind === "compound") {
              if (parentAst2[0].kind === "complex") {
                let path = ctx.path();
                let grandParent = path[path.length - 2];
                if (grandParent && grandParent.kind === "complex" && grandParent.nodes[0] !== ctx.parent) {
                  return;
                }
              }
              if (ctx.siblings.slice(ctx.index + 1).some(
                (sibling) => isUniversalSelector(sibling) || isTypeSelector(sibling)
              )) {
                return;
              }
              if (ctx.index === 0) {
                node.value = parentSelector;
                return;
              } else if (ctx.index === ctx.siblings.length - 1) {
                if (parentAst2[0].kind === "complex" || isUniversalSelector(parentAst2[0]) || isTypeSelector(parentAst2[0])) {
                  return;
                }
                node.value = parentSelector;
                return;
              } else {
                if (parentAst2[0].kind === "complex" || isUniversalSelector(parentAst2[0]) || isTypeSelector(parentAst2[0])) {
                  return;
                }
                node.value = parentSelector;
                return;
              }
            } else if (ctx.parent.kind === "function") {
              node.value = parentSelector;
              return;
            }
          },
          exit(node, ctx) {
            if (ctx.index === 0 && ctx.siblings.length > 1 && ctx.parent?.kind === "compound" && isUniversalSelector(node)) {
              let next = ctx.siblings[1];
              if (next.kind === "selector" && next.value.charCodeAt(0) === PIPE) {
                return;
              }
              return WalkAction.ReplaceSkip([]);
            }
          }
        });
        if (changed) return toCss(ast2);
      }
      let parentAst = parseSelectorCache.get(parentSelector);
      return `${parentAst.length === 1 && parentAst[0].kind === "list" ? `:is(${parentSelector})` : parentSelector} ${selector2}`;
    }
  }
  var HOISTABLE_AT_RULES = /* @__PURE__ */ new Set([
    "@container",
    "@layer",
    "@media",
    "@page",
    "@scope",
    "@starting-style",
    "@supports",
    "@view-transition"
  ]);
  var DROPPABLE_IF_EMPTY_AT_RULES = /* @__PURE__ */ new Set([
    "@container",
    "@media",
    "@page",
    "@scope",
    "@starting-style",
    "@supports",
    "@view-transition"
  ]);
  function toCss3(ast, track) {
    let pos = 0;
    let source = {
      file: null,
      code: ""
    };
    function stringify(node, depth = 0) {
      let css2 = "";
      let indent = "  ".repeat(depth);
      if (node.kind === "declaration") {
        css2 += `${indent}${node.property}: ${node.value}${node.important ? " !important" : ""};
`;
        if (track) {
          pos += indent.length;
          let start = pos;
          pos += node.property.length;
          pos += 2;
          pos += node.value?.length ?? 0;
          if (node.important) {
            pos += 11;
          }
          let end = pos;
          pos += 2;
          node.dst = [source, start, end];
        }
      } else if (node.kind === "rule") {
        css2 += `${indent}${node.selector} {
`;
        if (track) {
          pos += indent.length;
          let start = pos;
          pos += node.selector.length;
          pos += 1;
          let end = pos;
          node.dst = [source, start, end];
          pos += 2;
        }
        for (let child of node.nodes) {
          css2 += stringify(child, depth + 1);
        }
        css2 += `${indent}}
`;
        if (track) {
          pos += indent.length;
          pos += 2;
        }
      } else if (node.kind === "at-rule") {
        if (node.nodes.length === 0) {
          let css3 = `${indent}${node.name} ${node.params};
`;
          if (track) {
            pos += indent.length;
            let start = pos;
            pos += node.name.length;
            pos += 1;
            pos += node.params.length;
            let end = pos;
            pos += 2;
            node.dst = [source, start, end];
          }
          return css3;
        }
        css2 += `${indent}${node.name}${node.params ? ` ${node.params} ` : " "}{
`;
        if (track) {
          pos += indent.length;
          let start = pos;
          pos += node.name.length;
          if (node.params) {
            pos += 1;
            pos += node.params.length;
          }
          pos += 1;
          let end = pos;
          node.dst = [source, start, end];
          pos += 2;
        }
        for (let child of node.nodes) {
          css2 += stringify(child, depth + 1);
        }
        css2 += `${indent}}
`;
        if (track) {
          pos += indent.length;
          pos += 2;
        }
      } else if (node.kind === "comment") {
        css2 += `${indent}/*${node.value}*/
`;
        if (track) {
          pos += indent.length;
          let start = pos;
          pos += 2 + node.value.length + 2;
          let end = pos;
          node.dst = [source, start, end];
          pos += 1;
        }
      } else if (node.kind === "context" || node.kind === "at-root") {
        return "";
      } else {
        node;
      }
      return css2;
    }
    let css = "";
    for (let node of ast) {
      css += stringify(node, 0);
    }
    source.code = css;
    return css;
  }
  function findNode(ast, fn) {
    let foundPath = [];
    walk(ast, (node, ctx) => {
      if (fn(node)) {
        foundPath = ctx.path();
        foundPath.push(node);
        return WalkAction.Stop;
      }
    });
    return foundPath;
  }
  function isVariableUsed(variable, theme2, variableDependencies, alreadySeenVariables = /* @__PURE__ */ new Set()) {
    if (alreadySeenVariables.has(variable)) {
      return true;
    } else {
      alreadySeenVariables.add(variable);
    }
    let options = theme2.getOptions(variable);
    if (options & (8 /* STATIC */ | 16 /* USED */)) {
      return true;
    } else {
      let dependencies = variableDependencies.get(variable) ?? [];
      for (let dependency of dependencies) {
        if (isVariableUsed(dependency, theme2, variableDependencies, alreadySeenVariables)) {
          return true;
        }
      }
    }
    return false;
  }
  function extractKeyframeNames(value2) {
    return value2.split(/[\s,]+/);
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/math-operators.ts
  var LOWER_A = 97;
  var LOWER_Z = 122;
  var UPPER_A = 65;
  var UPPER_Z = 90;
  var LOWER_E = 101;
  var UPPER_E = 69;
  var ZERO = 48;
  var NINE = 57;
  var ADD = 43;
  var SUB = 45;
  var MUL = 42;
  var DIV = 47;
  var OPEN_PAREN5 = 40;
  var CLOSE_PAREN5 = 41;
  var COMMA3 = 44;
  var SPACE4 = 32;
  var PERCENT = 37;
  var MATH_FUNCTIONS = [
    "calc",
    "min",
    "max",
    "clamp",
    "mod",
    "rem",
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "atan2",
    "pow",
    "sqrt",
    "hypot",
    "log",
    "exp",
    "round"
  ];
  function hasMathFn(input) {
    return input.indexOf("(") !== -1 && MATH_FUNCTIONS.some((fn) => input.includes(`${fn}(`));
  }
  function addWhitespaceAroundMathOperators(input) {
    if (!MATH_FUNCTIONS.some((fn) => input.includes(fn))) {
      return input;
    }
    let result = "";
    let formattable = [];
    let valuePos = null;
    let lastValuePos = null;
    for (let i = 0; i < input.length; i++) {
      let char = input.charCodeAt(i);
      if (char >= ZERO && char <= NINE) {
        valuePos = i;
      } else if (valuePos !== null && (char === PERCENT || char >= LOWER_A && char <= LOWER_Z || char >= UPPER_A && char <= UPPER_Z)) {
        valuePos = i;
      } else {
        lastValuePos = valuePos;
        valuePos = null;
      }
      if (char === OPEN_PAREN5) {
        result += input[i];
        let start = i;
        for (let j = i - 1; j >= 0; j--) {
          let inner = input.charCodeAt(j);
          if (inner >= ZERO && inner <= NINE) {
            start = j;
          } else if (inner >= LOWER_A && inner <= LOWER_Z) {
            start = j;
          } else {
            break;
          }
        }
        let fn = input.slice(start, i);
        if (MATH_FUNCTIONS.includes(fn)) {
          formattable.unshift(true);
          continue;
        } else if (formattable[0] && fn === "") {
          formattable.unshift(true);
          continue;
        }
        formattable.unshift(false);
        continue;
      } else if (char === CLOSE_PAREN5) {
        result += input[i];
        formattable.shift();
      } else if (char === COMMA3 && formattable[0]) {
        result += `, `;
        continue;
      } else if (char === SPACE4 && formattable[0] && result.charCodeAt(result.length - 1) === SPACE4) {
        continue;
      } else if ((char === ADD || char === MUL || char === DIV || char === SUB) && formattable[0]) {
        let trimmed = result.trimEnd();
        let prev = trimmed.charCodeAt(trimmed.length - 1);
        let prevPrev = trimmed.charCodeAt(trimmed.length - 2);
        let next = input.charCodeAt(i + 1);
        if ((prev === LOWER_E || prev === UPPER_E) && prevPrev >= ZERO && prevPrev <= NINE) {
          result += input[i];
          continue;
        } else if (prev === ADD || prev === MUL || prev === DIV || prev === SUB) {
          result += input[i];
          continue;
        } else if (prev === OPEN_PAREN5 || prev === COMMA3) {
          result += input[i];
          continue;
        } else if (input.charCodeAt(i - 1) === SPACE4) {
          result += `${input[i]} `;
        } else if (
          // Previous is a digit
          prev >= ZERO && prev <= NINE || // Next is a digit
          next >= ZERO && next <= NINE || // Previous is end of a function call (or parenthesized expression)
          prev === CLOSE_PAREN5 || // Next is start of a parenthesized expression
          next === OPEN_PAREN5 || // Next is an operator
          next === ADD || next === MUL || next === DIV || next === SUB || // Previous position was a value (+ unit)
          lastValuePos !== null && lastValuePos === i - 1
        ) {
          result += ` ${input[i]} `;
        } else {
          result += input[i];
        }
      } else {
        result += input[i];
      }
    }
    return result;
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/decode-arbitrary-value.ts
  function decodeArbitraryValue(input) {
    if (input.indexOf("(") === -1) {
      return convertUnderscoresToWhitespace(input);
    }
    let ast = parse3(input);
    recursivelyDecodeArbitraryValues(ast);
    input = toCss2(ast);
    input = addWhitespaceAroundMathOperators(input);
    return input;
  }
  function convertUnderscoresToWhitespace(input, skipUnderscoreToSpace = false) {
    let output = "";
    for (let i = 0; i < input.length; i++) {
      let char = input[i];
      if (char === "\\" && input[i + 1] === "_") {
        output += "_";
        i += 1;
      } else if (char === "_" && !skipUnderscoreToSpace) {
        output += " ";
      } else {
        output += char;
      }
    }
    return output;
  }
  function recursivelyDecodeArbitraryValues(ast) {
    for (let node of ast) {
      switch (node.kind) {
        case "function": {
          if (node.value === "url" || node.value.endsWith("_url")) {
            node.value = convertUnderscoresToWhitespace(node.value);
            break;
          }
          if (node.value === "var" || node.value.endsWith("_var") || node.value === "theme" || node.value.endsWith("_theme")) {
            node.value = convertUnderscoresToWhitespace(node.value);
            for (let i = 0; i < node.nodes.length; i++) {
              if (i == 0 && node.nodes[i].kind === "word") {
                node.nodes[i].value = convertUnderscoresToWhitespace(node.nodes[i].value, true);
                continue;
              }
              recursivelyDecodeArbitraryValues([node.nodes[i]]);
            }
            break;
          }
          node.value = convertUnderscoresToWhitespace(node.value);
          recursivelyDecodeArbitraryValues(node.nodes);
          break;
        }
        case "separator":
        case "word": {
          node.value = convertUnderscoresToWhitespace(node.value);
          break;
        }
        default:
          never(node);
      }
    }
  }
  function never(value2) {
    throw new Error(`Unexpected value: ${value2}`);
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/is-valid-arbitrary.ts
  var BACKSLASH5 = 92;
  var OPEN_CURLY3 = 123;
  var CLOSE_CURLY3 = 125;
  var OPEN_PAREN6 = 40;
  var CLOSE_PAREN6 = 41;
  var OPEN_BRACKET4 = 91;
  var CLOSE_BRACKET4 = 93;
  var DOUBLE_QUOTE5 = 34;
  var SINGLE_QUOTE5 = 39;
  var SEMICOLON2 = 59;
  var closingBracketStack2 = new Uint8Array(256);
  function isValidArbitrary(input) {
    let stackPos = 0;
    let len = input.length;
    for (let idx = 0; idx < len; idx++) {
      let char = input.charCodeAt(idx);
      switch (char) {
        case BACKSLASH5:
          idx += 1;
          break;
        // Strings should be handled as-is until the end of the string. No need to
        // worry about balancing parens, brackets, or curlies inside a string.
        case SINGLE_QUOTE5:
        case DOUBLE_QUOTE5:
          while (++idx < len) {
            let nextChar = input.charCodeAt(idx);
            if (nextChar === BACKSLASH5) {
              idx += 1;
              continue;
            }
            if (nextChar === char) {
              break;
            }
          }
          break;
        case OPEN_PAREN6:
          closingBracketStack2[stackPos] = CLOSE_PAREN6;
          stackPos++;
          break;
        case OPEN_BRACKET4:
          closingBracketStack2[stackPos] = CLOSE_BRACKET4;
          stackPos++;
          break;
        case OPEN_CURLY3:
          break;
        case CLOSE_BRACKET4:
        case CLOSE_CURLY3:
        case CLOSE_PAREN6:
          if (stackPos === 0) return false;
          if (stackPos > 0 && char === closingBracketStack2[stackPos - 1]) {
            stackPos--;
          }
          break;
        case SEMICOLON2:
          if (stackPos === 0) return false;
          break;
      }
    }
    return true;
  }

  // ../tailwindcss/packages/tailwindcss/src/candidate.ts
  var COLON4 = 58;
  var DASH2 = 45;
  var LOWER_A2 = 97;
  var LOWER_Z2 = 122;
  var IS_VALID_NAMED_VALUE = /^[a-zA-Z0-9_.%-]+$/;
  function cloneCandidate(candidate) {
    switch (candidate.kind) {
      case "arbitrary":
        return {
          kind: candidate.kind,
          property: candidate.property,
          value: candidate.value,
          modifier: candidate.modifier ? { kind: candidate.modifier.kind, value: candidate.modifier.value } : null,
          variants: candidate.variants.map(cloneVariant),
          important: candidate.important,
          raw: candidate.raw
        };
      case "static":
        return {
          kind: candidate.kind,
          root: candidate.root,
          variants: candidate.variants.map(cloneVariant),
          important: candidate.important,
          raw: candidate.raw
        };
      case "functional":
        return {
          kind: candidate.kind,
          root: candidate.root,
          value: candidate.value ? candidate.value.kind === "arbitrary" ? {
            kind: candidate.value.kind,
            dataType: candidate.value.dataType,
            value: candidate.value.value
          } : {
            kind: candidate.value.kind,
            value: candidate.value.value,
            fraction: candidate.value.fraction
          } : null,
          modifier: candidate.modifier ? { kind: candidate.modifier.kind, value: candidate.modifier.value } : null,
          variants: candidate.variants.map(cloneVariant),
          important: candidate.important,
          raw: candidate.raw
        };
      default:
        candidate;
        throw new Error("Unknown candidate kind");
    }
  }
  function cloneVariant(variant) {
    switch (variant.kind) {
      case "arbitrary":
        return {
          kind: variant.kind,
          selector: variant.selector,
          relative: variant.relative
        };
      case "static":
        return { kind: variant.kind, root: variant.root };
      case "functional":
        return {
          kind: variant.kind,
          root: variant.root,
          value: variant.value ? { kind: variant.value.kind, value: variant.value.value } : null,
          modifier: variant.modifier ? { kind: variant.modifier.kind, value: variant.modifier.value } : null
        };
      case "compound":
        return {
          kind: variant.kind,
          root: variant.root,
          variant: cloneVariant(variant.variant),
          modifier: variant.modifier ? { kind: variant.modifier.kind, value: variant.modifier.value } : null
        };
      default:
        variant;
        throw new Error("Unknown variant kind");
    }
  }
  function* parseCandidate(input, designSystem) {
    let rawVariants = segment(input, ":");
    if (designSystem.theme.prefix) {
      if (rawVariants.length === 1) return null;
      if (rawVariants[0] !== designSystem.theme.prefix) return null;
      rawVariants.shift();
    }
    let base2 = rawVariants.pop();
    let parsedCandidateVariants = [];
    for (let i = rawVariants.length - 1; i >= 0; --i) {
      let parsedVariant = designSystem.parseVariant(rawVariants[i]);
      if (parsedVariant === null) return;
      parsedCandidateVariants.push(parsedVariant);
    }
    let important = false;
    if (base2[base2.length - 1] === "!") {
      important = true;
      base2 = base2.slice(0, -1);
    } else if (base2[0] === "!") {
      important = true;
      base2 = base2.slice(1);
    }
    if (designSystem.utilities.has(base2, "static") && !base2.includes("[")) {
      yield {
        kind: "static",
        root: base2,
        variants: parsedCandidateVariants,
        important,
        raw: input
      };
    }
    let parts = segment(base2, "/");
    if (parts.length > 2) return;
    let [baseWithoutModifier, modifierSegment = null] = parts;
    let parsedModifier = modifierSegment === null ? null : parseModifier(modifierSegment);
    if (modifierSegment !== null && parsedModifier === null) return;
    if (baseWithoutModifier[0] === "[") {
      if (baseWithoutModifier[baseWithoutModifier.length - 1] !== "]") return;
      let charCode = baseWithoutModifier.charCodeAt(1);
      if (charCode !== DASH2 && !(charCode >= LOWER_A2 && charCode <= LOWER_Z2)) {
        return;
      }
      baseWithoutModifier = baseWithoutModifier.slice(1, -1);
      let idx = baseWithoutModifier.indexOf(":");
      if (idx === -1 || idx === 0 || idx === baseWithoutModifier.length - 1) return;
      let property2 = baseWithoutModifier.slice(0, idx);
      let value2 = decodeArbitraryValue(baseWithoutModifier.slice(idx + 1));
      if (!isValidArbitrary(value2)) return;
      yield {
        kind: "arbitrary",
        property: property2,
        value: value2,
        modifier: parsedModifier,
        variants: parsedCandidateVariants,
        important,
        raw: input
      };
      return;
    }
    let roots;
    if (baseWithoutModifier[baseWithoutModifier.length - 1] === "]") {
      let idx = baseWithoutModifier.indexOf("-[");
      if (idx === -1) return;
      let root = baseWithoutModifier.slice(0, idx);
      if (!designSystem.utilities.has(root, "functional")) return;
      let value2 = baseWithoutModifier.slice(idx + 1);
      roots = [[root, value2]];
    } else if (baseWithoutModifier[baseWithoutModifier.length - 1] === ")") {
      let idx = baseWithoutModifier.indexOf("-(");
      if (idx === -1) return;
      let root = baseWithoutModifier.slice(0, idx);
      if (!designSystem.utilities.has(root, "functional")) return;
      let value2 = baseWithoutModifier.slice(idx + 2, -1);
      let parts2 = segment(value2, ":");
      let dataType = null;
      if (parts2.length === 2) {
        dataType = parts2[0];
        value2 = parts2[1];
      }
      if (value2[0] !== "-" || value2[1] !== "-") return;
      if (!isValidArbitrary(value2)) return;
      roots = [[root, dataType === null ? `[var(${value2})]` : `[${dataType}:var(${value2})]`]];
    } else {
      roots = findRoots(baseWithoutModifier, (root) => {
        return designSystem.utilities.has(root, "functional");
      });
    }
    for (let [root, value2] of roots) {
      let candidate = {
        kind: "functional",
        root,
        modifier: parsedModifier,
        value: null,
        variants: parsedCandidateVariants,
        important,
        raw: input
      };
      if (value2 === null) {
        yield candidate;
        continue;
      }
      {
        let startArbitraryIdx = value2.indexOf("[");
        let valueIsArbitrary = startArbitraryIdx !== -1;
        if (valueIsArbitrary) {
          if (value2[value2.length - 1] !== "]") return;
          let arbitraryValue = decodeArbitraryValue(value2.slice(startArbitraryIdx + 1, -1));
          if (!isValidArbitrary(arbitraryValue)) continue;
          let typehint = null;
          for (let i = 0; i < arbitraryValue.length; i++) {
            let code = arbitraryValue.charCodeAt(i);
            if (code === COLON4) {
              typehint = arbitraryValue.slice(0, i);
              arbitraryValue = arbitraryValue.slice(i + 1);
              break;
            }
            if (code === DASH2 || code >= LOWER_A2 && code <= LOWER_Z2) {
              continue;
            }
            break;
          }
          if (arbitraryValue.length === 0 || arbitraryValue.trim().length === 0) {
            continue;
          }
          if (typehint === "") continue;
          candidate.value = {
            kind: "arbitrary",
            dataType: typehint || null,
            value: arbitraryValue
          };
        } else {
          let fraction = modifierSegment === null || candidate.modifier?.kind === "arbitrary" ? null : `${value2}/${modifierSegment}`;
          if (!IS_VALID_NAMED_VALUE.test(value2)) continue;
          candidate.value = {
            kind: "named",
            value: value2,
            fraction
          };
        }
      }
      yield candidate;
    }
  }
  function parseModifier(modifier) {
    if (modifier[0] === "[" && modifier[modifier.length - 1] === "]") {
      let arbitraryValue = decodeArbitraryValue(modifier.slice(1, -1));
      if (!isValidArbitrary(arbitraryValue)) return null;
      if (arbitraryValue.length === 0 || arbitraryValue.trim().length === 0) return null;
      return {
        kind: "arbitrary",
        value: arbitraryValue
      };
    }
    if (modifier[0] === "(" && modifier[modifier.length - 1] === ")") {
      modifier = modifier.slice(1, -1);
      if (modifier[0] !== "-" || modifier[1] !== "-") return null;
      if (!isValidArbitrary(modifier)) return null;
      modifier = `var(${modifier})`;
      let arbitraryValue = decodeArbitraryValue(modifier);
      return {
        kind: "arbitrary",
        value: arbitraryValue
      };
    }
    if (!IS_VALID_NAMED_VALUE.test(modifier)) return null;
    return {
      kind: "named",
      value: modifier
    };
  }
  function parseVariant(variant, designSystem) {
    if (variant[0] === "[" && variant[variant.length - 1] === "]") {
      if (variant[1] === "@" && variant.includes("&")) return null;
      let selector2 = decodeArbitraryValue(variant.slice(1, -1));
      if (!isValidArbitrary(selector2)) return null;
      if (selector2.length === 0 || selector2.trim().length === 0) return null;
      let relative = selector2[0] === ">" || selector2[0] === "+" || selector2[0] === "~";
      if (!relative && selector2[0] !== "@" && !selector2.includes("&")) {
        selector2 = `&:is(${selector2})`;
      }
      return {
        kind: "arbitrary",
        selector: selector2,
        relative
      };
    }
    {
      let parts = segment(variant, "/");
      if (parts.length > 2) return null;
      let [variantWithoutModifier, modifier = null] = parts;
      let roots = findRoots(variantWithoutModifier, (root) => {
        return designSystem.variants.has(root);
      });
      for (let [root, value2] of roots) {
        switch (designSystem.variants.kind(root)) {
          case "static": {
            if (value2 !== null) return null;
            if (modifier !== null) return null;
            return {
              kind: "static",
              root
            };
          }
          case "functional": {
            let parsedModifier = modifier === null ? null : parseModifier(modifier);
            if (modifier !== null && parsedModifier === null) return null;
            if (value2 === null) {
              return {
                kind: "functional",
                root,
                modifier: parsedModifier,
                value: null
              };
            }
            if (value2[value2.length - 1] === "]") {
              if (value2[0] !== "[") continue;
              let arbitraryValue = decodeArbitraryValue(value2.slice(1, -1));
              if (!isValidArbitrary(arbitraryValue)) return null;
              if (arbitraryValue.length === 0 || arbitraryValue.trim().length === 0) return null;
              return {
                kind: "functional",
                root,
                modifier: parsedModifier,
                value: {
                  kind: "arbitrary",
                  value: arbitraryValue
                }
              };
            }
            if (value2[value2.length - 1] === ")") {
              if (value2[0] !== "(") continue;
              let arbitraryValue = decodeArbitraryValue(value2.slice(1, -1));
              if (!isValidArbitrary(arbitraryValue)) return null;
              if (arbitraryValue.length === 0 || arbitraryValue.trim().length === 0) return null;
              if (arbitraryValue[0] !== "-" || arbitraryValue[1] !== "-") return null;
              return {
                kind: "functional",
                root,
                modifier: parsedModifier,
                value: {
                  kind: "arbitrary",
                  value: `var(${arbitraryValue})`
                }
              };
            }
            if (!IS_VALID_NAMED_VALUE.test(value2)) continue;
            return {
              kind: "functional",
              root,
              modifier: parsedModifier,
              value: { kind: "named", value: value2 }
            };
          }
          case "compound": {
            if (value2 === null) return null;
            if (modifier && (root === "not" || root === "has" || root === "in")) {
              value2 = `${value2}/${modifier}`;
              modifier = null;
            }
            let subVariant = designSystem.parseVariant(value2);
            if (subVariant === null) return null;
            if (!designSystem.variants.compoundsWith(root, subVariant)) return null;
            let parsedModifier = modifier === null ? null : parseModifier(modifier);
            if (modifier !== null && parsedModifier === null) return null;
            return {
              kind: "compound",
              root,
              modifier: parsedModifier,
              variant: subVariant
            };
          }
        }
      }
    }
    return null;
  }
  function* findRoots(input, exists) {
    if (exists(input)) {
      yield [input, null];
    }
    let idx = input.lastIndexOf("-");
    while (idx > 0) {
      let maybeRoot = input.slice(0, idx);
      if (exists(maybeRoot)) {
        let root = [maybeRoot, input.slice(idx + 1)];
        if (root[1] === "") break;
        if (root[0] === "@" && exists("@") && input[idx] === "-") break;
        yield root;
      }
      idx = input.lastIndexOf("-", idx - 1);
    }
    if (input[0] === "@" && exists("@")) {
      yield ["@", input.slice(1)];
    }
  }
  function printCandidate(designSystem, candidate) {
    let parts = [];
    for (let variant of candidate.variants) {
      parts.unshift(printVariant(variant));
    }
    if (designSystem.theme.prefix) {
      parts.unshift(designSystem.theme.prefix);
    }
    let base2 = "";
    if (candidate.kind === "static") {
      base2 += candidate.root;
    }
    if (candidate.kind === "functional") {
      base2 += candidate.root;
      if (candidate.value) {
        if (candidate.value.kind === "arbitrary") {
          if (candidate.value !== null) {
            let isVarValue = isVar(candidate.value.value);
            let value2 = isVarValue ? candidate.value.value.slice(4, -1) : candidate.value.value;
            let [open, close] = isVarValue ? ["(", ")"] : ["[", "]"];
            if (candidate.value.dataType) {
              base2 += `-${open}${candidate.value.dataType}:${printArbitraryValue(value2)}${close}`;
            } else {
              base2 += `-${open}${printArbitraryValue(value2)}${close}`;
            }
          }
        } else if (candidate.value.kind === "named") {
          base2 += `-${candidate.value.value}`;
        }
      }
    }
    if (candidate.kind === "arbitrary") {
      base2 += `[${candidate.property}:${printArbitraryValue(candidate.value)}]`;
    }
    if (candidate.kind === "arbitrary" || candidate.kind === "functional") {
      base2 += printModifier(candidate.modifier);
    }
    if (candidate.important) {
      base2 += "!";
    }
    parts.push(base2);
    return parts.join(":");
  }
  function printModifier(modifier) {
    if (modifier === null) return "";
    let isVarValue = isVar(modifier.value);
    let value2 = isVarValue ? modifier.value.slice(4, -1) : modifier.value;
    let [open, close] = isVarValue ? ["(", ")"] : ["[", "]"];
    if (modifier.kind === "arbitrary") {
      return `/${open}${printArbitraryValue(value2)}${close}`;
    } else if (modifier.kind === "named") {
      return `/${modifier.value}`;
    } else {
      modifier;
      return "";
    }
  }
  function printVariant(variant) {
    if (variant.kind === "static") {
      return variant.root;
    }
    if (variant.kind === "arbitrary") {
      return `[${printArbitraryValue(simplifyArbitraryVariant(variant.selector))}]`;
    }
    let base2 = "";
    if (variant.kind === "functional") {
      base2 += variant.root;
      let hasDash = variant.root !== "@";
      if (variant.value) {
        if (variant.value.kind === "arbitrary") {
          let isVarValue = isVar(variant.value.value);
          let value2 = isVarValue ? variant.value.value.slice(4, -1) : variant.value.value;
          let [open, close] = isVarValue ? ["(", ")"] : ["[", "]"];
          base2 += `${hasDash ? "-" : ""}${open}${printArbitraryValue(value2)}${close}`;
        } else if (variant.value.kind === "named") {
          base2 += `${hasDash ? "-" : ""}${variant.value.value}`;
        }
      }
    }
    if (variant.kind === "compound") {
      base2 += variant.root;
      base2 += "-";
      base2 += printVariant(variant.variant);
    }
    if (variant.kind === "functional" || variant.kind === "compound") {
      base2 += printModifier(variant.modifier);
    }
    return base2;
  }
  var printArbitraryValueCache = new DefaultMap((input) => {
    let ast = parse3(input);
    let drop = /* @__PURE__ */ new Set();
    let symbols = /* @__PURE__ */ new Set([
      // Selectors
      "~",
      // Subsequent sibling combinator
      ">",
      // Child combinator
      // Math operators
      "+",
      // or next sibling combinator
      "-",
      "*",
      // or universal selector
      "/"
    ]);
    walk(ast, (node, ctx) => {
      if (node.kind === "word" && symbols.has(node.value)) {
        let idx = ctx.index;
        if (idx === -1) return;
        let previous = ctx.siblings[idx - 1];
        if (previous?.kind !== "separator" || previous.value !== " ") return;
        let next = ctx.siblings[idx + 1];
        if (next?.kind !== "separator" || next.value !== " ") return;
        let previousPrevious = ctx.siblings[idx - 2];
        if (previousPrevious && symbols.has(previousPrevious.value)) return;
        let nextNext = ctx.siblings[idx + 2];
        if (nextNext && symbols.has(nextNext.value)) return;
        drop.add(previous);
        drop.add(next);
      } else if (node.kind === "separator" && node.value.length > 0 && node.value.trim() === "") {
        if (ctx.siblings[0] === node || ctx.siblings[ctx.siblings.length - 1] === node) {
          drop.add(node);
        }
      } else if (node.kind === "separator" && node.value.trim() === ",") {
        node.value = ",";
      } else if (node.kind === "function" && node.value.startsWith("--")) {
        let idx = ctx.index;
        if (idx <= 0) return;
        let previous = ctx.siblings[idx - 1];
        if (previous?.kind === "separator" && previous.value === ",") return;
        let previousPrevious = ctx.siblings[idx - 2];
        if (previousPrevious && !symbols.has(previousPrevious.value)) return;
        return WalkAction.ReplaceSkip({
          kind: "function",
          value: "",
          // Unnamed, so will result in `(…)`
          nodes: [node]
        });
      }
    });
    if (drop.size > 0) {
      walk(ast, (node) => {
        if (drop.has(node)) {
          drop.delete(node);
          return WalkAction.ReplaceSkip([]);
        }
      });
    }
    recursivelyEscapeUnderscores(ast);
    return toCss2(ast);
  });
  function printArbitraryValue(input) {
    return printArbitraryValueCache.get(input);
  }
  var simplifyArbitraryVariantCache = new DefaultMap((input) => {
    let ast = parse3(input);
    if (ast.length === 3 && // &
    ast[0].kind === "word" && ast[0].value === "&" && // :
    ast[1].kind === "separator" && ast[1].value === ":" && // is(…)
    ast[2].kind === "function" && ast[2].value === "is") {
      return toCss2(ast[2].nodes);
    }
    return input;
  });
  function simplifyArbitraryVariant(input) {
    return simplifyArbitraryVariantCache.get(input);
  }
  function recursivelyEscapeUnderscores(ast) {
    for (let node of ast) {
      switch (node.kind) {
        case "function": {
          if (node.value === "url" || node.value.endsWith("_url")) {
            node.value = escapeUnderscore(node.value);
            break;
          }
          if (node.value === "var" || node.value.endsWith("_var") || node.value === "theme" || node.value.endsWith("_theme")) {
            node.value = escapeUnderscore(node.value);
            for (let i = 0; i < node.nodes.length; i++) {
              recursivelyEscapeUnderscores([node.nodes[i]]);
            }
            break;
          }
          node.value = escapeUnderscore(node.value);
          recursivelyEscapeUnderscores(node.nodes);
          break;
        }
        case "separator":
          node.value = escapeUnderscore(node.value);
          break;
        case "word": {
          if (node.value[0] !== "-" || node.value[1] !== "-") {
            node.value = escapeUnderscore(node.value);
          }
          break;
        }
        default:
          never2(node);
      }
    }
  }
  var isVarCache = new DefaultMap((value2) => {
    let ast = parse3(value2);
    return ast.length === 1 && ast[0].kind === "function" && ast[0].value === "var";
  });
  function isVar(value2) {
    return isVarCache.get(value2);
  }
  function never2(value2) {
    throw new Error(`Unexpected value: ${value2}`);
  }
  function escapeUnderscore(value2) {
    return value2.replaceAll("_", String.raw`\_`).replaceAll(" ", "_");
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/compare-breakpoints.ts
  function compareBreakpoints(a, z, direction) {
    if (a === z) return 0;
    let aIsCssFunction = a.indexOf("(");
    let zIsCssFunction = z.indexOf("(");
    let aBucket = aIsCssFunction === -1 ? (
      // No CSS function found, bucket by unit instead
      a.replace(/[\d.]+/g, "")
    ) : (
      // CSS function found, bucket by function name
      a.slice(0, aIsCssFunction)
    );
    let zBucket = zIsCssFunction === -1 ? (
      // No CSS function found, bucket by unit
      z.replace(/[\d.]+/g, "")
    ) : (
      // CSS function found, bucket by function name
      z.slice(0, zIsCssFunction)
    );
    let order = (
      // Compare by bucket name
      (aBucket === zBucket ? 0 : aBucket < zBucket ? -1 : 1) || // If bucket names are the same, compare by value
      (direction === "asc" ? parseInt(a) - parseInt(z) : parseInt(z) - parseInt(a))
    );
    if (Number.isNaN(order)) {
      return a < z ? -1 : 1;
    }
    return order;
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/dimensions.ts
  var DIMENSION_REGEX = /^(?<value>[-+]?(?:\d*\.)?\d+)(?<unit>[a-z]+|%)?$/i;
  var dimensions = new DefaultMap((input) => {
    let match = DIMENSION_REGEX.exec(input);
    if (!match) return null;
    let value2 = match.groups?.value;
    if (value2 === void 0) return null;
    let valueAsNumber = Number(value2);
    if (Number.isNaN(valueAsNumber)) return null;
    let unit = match.groups?.unit;
    if (unit === void 0) return [valueAsNumber, null];
    return [valueAsNumber, unit];
  });

  // ../tailwindcss/packages/tailwindcss/src/utils/is-color.ts
  var HASH2 = 35;
  var NAMED_COLORS = /* @__PURE__ */ new Set([
    // CSS Level 1 colors
    "black",
    "silver",
    "gray",
    "white",
    "maroon",
    "red",
    "purple",
    "fuchsia",
    "green",
    "lime",
    "olive",
    "yellow",
    "navy",
    "blue",
    "teal",
    "aqua",
    // CSS Level 2/3 colors
    "aliceblue",
    "antiquewhite",
    "aqua",
    "aquamarine",
    "azure",
    "beige",
    "bisque",
    "black",
    "blanchedalmond",
    "blue",
    "blueviolet",
    "brown",
    "burlywood",
    "cadetblue",
    "chartreuse",
    "chocolate",
    "coral",
    "cornflowerblue",
    "cornsilk",
    "crimson",
    "cyan",
    "darkblue",
    "darkcyan",
    "darkgoldenrod",
    "darkgray",
    "darkgreen",
    "darkgrey",
    "darkkhaki",
    "darkmagenta",
    "darkolivegreen",
    "darkorange",
    "darkorchid",
    "darkred",
    "darksalmon",
    "darkseagreen",
    "darkslateblue",
    "darkslategray",
    "darkslategrey",
    "darkturquoise",
    "darkviolet",
    "deeppink",
    "deepskyblue",
    "dimgray",
    "dimgrey",
    "dodgerblue",
    "firebrick",
    "floralwhite",
    "forestgreen",
    "fuchsia",
    "gainsboro",
    "ghostwhite",
    "gold",
    "goldenrod",
    "gray",
    "green",
    "greenyellow",
    "grey",
    "honeydew",
    "hotpink",
    "indianred",
    "indigo",
    "ivory",
    "khaki",
    "lavender",
    "lavenderblush",
    "lawngreen",
    "lemonchiffon",
    "lightblue",
    "lightcoral",
    "lightcyan",
    "lightgoldenrodyellow",
    "lightgray",
    "lightgreen",
    "lightgrey",
    "lightpink",
    "lightsalmon",
    "lightseagreen",
    "lightskyblue",
    "lightslategray",
    "lightslategrey",
    "lightsteelblue",
    "lightyellow",
    "lime",
    "limegreen",
    "linen",
    "magenta",
    "maroon",
    "mediumaquamarine",
    "mediumblue",
    "mediumorchid",
    "mediumpurple",
    "mediumseagreen",
    "mediumslateblue",
    "mediumspringgreen",
    "mediumturquoise",
    "mediumvioletred",
    "midnightblue",
    "mintcream",
    "mistyrose",
    "moccasin",
    "navajowhite",
    "navy",
    "oldlace",
    "olive",
    "olivedrab",
    "orange",
    "orangered",
    "orchid",
    "palegoldenrod",
    "palegreen",
    "paleturquoise",
    "palevioletred",
    "papayawhip",
    "peachpuff",
    "peru",
    "pink",
    "plum",
    "powderblue",
    "purple",
    "rebeccapurple",
    "red",
    "rosybrown",
    "royalblue",
    "saddlebrown",
    "salmon",
    "sandybrown",
    "seagreen",
    "seashell",
    "sienna",
    "silver",
    "skyblue",
    "slateblue",
    "slategray",
    "slategrey",
    "snow",
    "springgreen",
    "steelblue",
    "tan",
    "teal",
    "thistle",
    "tomato",
    "turquoise",
    "violet",
    "wheat",
    "white",
    "whitesmoke",
    "yellow",
    "yellowgreen",
    // Keywords
    "transparent",
    "currentcolor",
    // System colors
    "canvas",
    "canvastext",
    "linktext",
    "visitedtext",
    "activetext",
    "buttonface",
    "buttontext",
    "buttonborder",
    "field",
    "fieldtext",
    "highlight",
    "highlighttext",
    "selecteditem",
    "selecteditemtext",
    "mark",
    "marktext",
    "graytext",
    "accentcolor",
    "accentcolortext"
  ]);
  var IS_COLOR_FN = /^(rgba?|hsla?|hwb|color|(ok)?(lab|lch)|light-dark|color-mix|--alpha)\(/i;
  function isColor(value2) {
    return value2.charCodeAt(0) === HASH2 || IS_COLOR_FN.test(value2) || NAMED_COLORS.has(value2.toLowerCase());
  }
  function isNamedColor(value2) {
    return NAMED_COLORS.has(value2.toLowerCase());
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/infer-data-type.ts
  var checks = {
    color: isColor,
    length: isLength,
    percentage: isPercentage,
    ratio: isFraction,
    number: isNumber,
    integer: isPositiveInteger,
    url: isUrl,
    position: isBackgroundPosition,
    "bg-size": isBackgroundSize,
    "line-width": isLineWidth,
    image: isImage,
    "family-name": isFamilyName,
    "generic-name": isGenericName,
    "absolute-size": isAbsoluteSize,
    "relative-size": isRelativeSize,
    angle: isAngle,
    vector: isVector
  };
  function inferDataType(value2, types) {
    if (value2.startsWith("var(")) return null;
    for (let type of types) {
      if (checks[type]?.(value2)) {
        return type;
      }
    }
    return null;
  }
  var IS_URL = /^url\(.*\)$/;
  function isUrl(value2) {
    return IS_URL.test(value2);
  }
  function isLineWidth(value2) {
    return segment(value2, " ").every(
      (value3) => isLength(value3) || isNumber(value3) || value3 === "thin" || value3 === "medium" || value3 === "thick"
    );
  }
  var IS_IMAGE_FN = /^(?:element|image|cross-fade|image-set)\(/;
  var IS_GRADIENT_FN = /^(repeating-)?(conic|linear|radial)-gradient\(/;
  function isImage(value2) {
    let count = 0;
    for (let part of segment(value2, ",")) {
      if (part.startsWith("var(")) continue;
      if (isUrl(part)) {
        count += 1;
        continue;
      }
      if (IS_GRADIENT_FN.test(part)) {
        count += 1;
        continue;
      }
      if (IS_IMAGE_FN.test(part)) {
        count += 1;
        continue;
      }
      return false;
    }
    return count > 0;
  }
  function isGenericName(value2) {
    return value2 === "serif" || value2 === "sans-serif" || value2 === "monospace" || value2 === "cursive" || value2 === "fantasy" || value2 === "system-ui" || value2 === "ui-serif" || value2 === "ui-sans-serif" || value2 === "ui-monospace" || value2 === "ui-rounded" || value2 === "math" || value2 === "emoji" || value2 === "fangsong";
  }
  function isFamilyName(value2) {
    let count = 0;
    for (let part of segment(value2, ",")) {
      let char = part.charCodeAt(0);
      if (char >= 48 && char <= 57) return false;
      if (part.startsWith("var(")) continue;
      count += 1;
    }
    return count > 0;
  }
  function isAbsoluteSize(value2) {
    return value2 === "xx-small" || value2 === "x-small" || value2 === "small" || value2 === "medium" || value2 === "large" || value2 === "x-large" || value2 === "xx-large" || value2 === "xxx-large";
  }
  function isRelativeSize(value2) {
    return value2 === "larger" || value2 === "smaller";
  }
  var HAS_NUMBER = /[+-]?\d*\.?\d+(?:[eE][+-]?\d+)?/;
  var IS_NUMBER = new RegExp(`^${HAS_NUMBER.source}$`);
  function isNumber(value2) {
    return IS_NUMBER.test(value2) || hasMathFn(value2);
  }
  var IS_PERCENTAGE = new RegExp(`^${HAS_NUMBER.source}%$`);
  function isPercentage(value2) {
    return IS_PERCENTAGE.test(value2) || hasMathFn(value2);
  }
  var IS_FRACTION = new RegExp(`^${HAS_NUMBER.source}\\s*/\\s*${HAS_NUMBER.source}$`);
  function isFraction(value2) {
    return IS_FRACTION.test(value2) || hasMathFn(value2);
  }
  var LENGTH_UNITS = [
    "cm",
    "mm",
    "Q",
    "in",
    "pc",
    "pt",
    "px",
    "em",
    "ex",
    "ch",
    "rem",
    "lh",
    "rlh",
    "vw",
    "vh",
    "vmin",
    "vmax",
    "vb",
    "vi",
    "svw",
    "svh",
    "lvw",
    "lvh",
    "dvw",
    "dvh",
    "cqw",
    "cqh",
    "cqi",
    "cqb",
    "cqmin",
    "cqmax"
  ];
  var IS_LENGTH = new RegExp(`^${HAS_NUMBER.source}(${LENGTH_UNITS.join("|")})$`);
  var IS_LENGTH_FN = /^(--spacing)\(/i;
  function isLength(value2) {
    return IS_LENGTH.test(value2) || IS_LENGTH_FN.test(value2) || hasMathFn(value2);
  }
  function isBackgroundPosition(value2) {
    let count = 0;
    for (let part of segment(value2, " ")) {
      if (part === "center" || part === "top" || part === "right" || part === "bottom" || part === "left") {
        count += 1;
        continue;
      }
      if (part.startsWith("var(")) continue;
      if (isLength(part) || isPercentage(part)) {
        count += 1;
        continue;
      }
      return false;
    }
    return count > 0;
  }
  function isBackgroundSize(value2) {
    let count = 0;
    for (let size of segment(value2, ",")) {
      if (size === "cover" || size === "contain") {
        count += 1;
        continue;
      }
      let values = segment(size, " ");
      if (values.length !== 1 && values.length !== 2) {
        return false;
      }
      if (values.every((value3) => value3 === "auto" || isLength(value3) || isPercentage(value3))) {
        count += 1;
        continue;
      }
    }
    return count > 0;
  }
  var ANGLE_UNITS = ["deg", "rad", "grad", "turn"];
  var IS_ANGLE = new RegExp(`^${HAS_NUMBER.source}(${ANGLE_UNITS.join("|")})$`);
  function isAngle(value2) {
    return IS_ANGLE.test(value2);
  }
  var IS_VECTOR = new RegExp(`^${HAS_NUMBER.source} +${HAS_NUMBER.source} +${HAS_NUMBER.source}$`);
  function isVector(value2) {
    return IS_VECTOR.test(value2);
  }
  function isPositiveInteger(value2) {
    let num = Number(value2);
    return Number.isInteger(num) && num >= 0 && String(num) === String(value2);
  }
  function isStrictPositiveInteger(value2) {
    let num = Number(value2);
    return Number.isInteger(num) && num > 0 && String(num) === String(value2);
  }
  function isValidSpacingMultiplier(value2) {
    return isMultipleOf(value2, 0.25);
  }
  function isValidOpacityValue(value2) {
    return isMultipleOf(value2, 0.25);
  }
  function isMultipleOf(value2, divisor) {
    let num = Number(value2);
    return num >= 0 && num % divisor === 0 && String(num) === String(value2);
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/replace-shadow-colors.ts
  var KEYWORDS = /* @__PURE__ */ new Set(["inset", "inherit", "initial", "revert", "unset"]);
  var LENGTH_FUNCTIONS = /* @__PURE__ */ new Set(["calc", "clamp", "max", "min", "--spacing"]);
  var COLOR_FUNCTIONS = /* @__PURE__ */ new Set([
    "color",
    "color-mix",
    "contrast-color",
    "device-cmyk",
    "hsl",
    "hsla",
    "hwb",
    "lab",
    "lch",
    "light-dark",
    "oklab",
    "oklch",
    "rgb",
    "rgba",
    "--alpha"
  ]);
  var LENGTH = /^-?(\d+|\.\d+)(.*?)$/;
  function replaceShadowColors(input, replacement) {
    function replaceAst(node) {
      let color = toCss2([node]);
      let updatedColor = replacement(color);
      let ast = parse3(updatedColor);
      return ast;
    }
    let shadows = segment(input, ",").map((shadow) => {
      shadow = shadow.trim();
      let ast = parse3(shadow);
      let unknown = null;
      let unknowns = 0;
      let lengths = 0;
      let replaced = false;
      walk(ast, (node) => {
        switch (node.kind) {
          case "word": {
            if (KEYWORDS.has(node.value.toLowerCase())) {
              return WalkAction.Continue;
            }
            if (LENGTH.test(node.value.toLowerCase())) {
              lengths++;
              return WalkAction.Continue;
            }
            if (node.value[0] === "#" || isNamedColor(node.value)) {
              replaced = true;
              return WalkAction.ReplaceStop(replaceAst(node));
            }
            unknown = node;
            unknowns++;
            break;
          }
          case "function": {
            if (COLOR_FUNCTIONS.has(node.value.toLowerCase())) {
              replaced = true;
              return WalkAction.ReplaceStop(replaceAst(node));
            }
            if (LENGTH_FUNCTIONS.has(node.value.toLowerCase())) {
              lengths++;
              return WalkAction.Skip;
            }
            unknown = node;
            unknowns++;
            return WalkAction.Skip;
          }
          // Ignore separators
          case "separator":
            return WalkAction.Continue;
          default:
            node;
        }
      });
      if (replaced) {
        return toCss2(ast);
      }
      if (lengths < 2) {
        return shadow;
      }
      if (unknowns === 0) {
        return `${shadow} ${replacement("currentcolor")}`;
      }
      if (unknowns === 1) {
        walk(ast, (node) => {
          if (node === unknown) {
            replaced = true;
            return WalkAction.ReplaceStop(replaceAst(node));
          }
          return WalkAction.Skip;
        });
      }
      return replaced ? toCss2(ast) : shadow;
    });
    return shadows.join(", ");
  }

  // ../tailwindcss/packages/tailwindcss/src/utilities.ts
  var DEFAULT_SPACING_SUGGESTIONS = [
    "0",
    "0.5",
    "1",
    "1.5",
    "2",
    "2.5",
    "3",
    "3.5",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "14",
    "16",
    "20",
    "24",
    "28",
    "32",
    "36",
    "40",
    "44",
    "48",
    "52",
    "56",
    "60",
    "64",
    "72",
    "80",
    "96"
  ];
  var Utilities = class {
    utilities = new DefaultMap(() => []);
    completions = /* @__PURE__ */ new Map();
    static(name, compileFn) {
      this.utilities.get(name).push({ kind: "static", compileFn });
    }
    functional(name, compileFn, options) {
      this.utilities.get(name).push({ kind: "functional", compileFn, options });
    }
    has(name, kind) {
      return this.utilities.has(name) && this.utilities.get(name).some((fn) => fn.kind === kind);
    }
    get(name) {
      return this.utilities.has(name) ? this.utilities.get(name) : [];
    }
    getCompletions(name) {
      if (this.has(name, "static")) {
        return this.completions.get(name)?.() ?? [{ supportsNegative: false, values: [], modifiers: [] }];
      }
      return this.completions.get(name)?.() ?? [];
    }
    suggest(name, groups) {
      let existingGroups = this.completions.get(name);
      if (existingGroups) {
        this.completions.set(name, () => [...existingGroups?.(), ...groups?.()]);
      } else {
        this.completions.set(name, groups);
      }
    }
    keys(kind) {
      let keys = [];
      for (let [key, fns] of this.utilities.entries()) {
        for (let fn of fns) {
          if (fn.kind === kind) {
            keys.push(key);
            break;
          }
        }
      }
      return keys;
    }
  };
  function property(ident, initialValue, syntax) {
    return atRule("@property", ident, [
      decl("syntax", syntax ? `"${syntax}"` : `"*"`),
      decl("inherits", "false"),
      // If there's no initial value, it's important that we omit it rather than
      // use an empty value. Safari currently doesn't support an empty
      // `initial-value` properly, so we have to design how we use things around
      // the guaranteed invalid value instead, which is how `initial-value`
      // behaves when omitted.
      ...initialValue ? [decl("initial-value", initialValue)] : []
    ]);
  }
  function withAlpha(value2, alpha2) {
    if (alpha2 === null) return value2;
    let alphaAsNumber = Number(alpha2);
    if (!Number.isNaN(alphaAsNumber)) {
      alpha2 = `${alphaAsNumber * 100}%`;
    }
    if (alpha2 === "100%") {
      return value2;
    }
    return `color-mix(in oklab, ${value2} ${alpha2}, transparent)`;
  }
  function replaceAlpha(value2, alpha2) {
    let alphaAsNumber = Number(alpha2);
    if (!Number.isNaN(alphaAsNumber)) {
      alpha2 = `${alphaAsNumber * 100}%`;
    }
    return `oklab(from ${value2} l a b / ${alpha2})`;
  }
  function asColor(value2, modifier, theme2) {
    if (!modifier) return value2;
    if (modifier.kind === "arbitrary") {
      return withAlpha(value2, modifier.value);
    }
    let alpha2 = theme2.resolve(modifier.value, ["--opacity"]);
    if (alpha2) {
      return withAlpha(value2, alpha2);
    }
    if (!isValidOpacityValue(modifier.value)) {
      return null;
    }
    return withAlpha(value2, `${modifier.value}%`);
  }
  function resolveThemeColor(candidate, theme2, themeKeys) {
    if (false) {
      if (!candidate.value) {
        throw new Error("resolveThemeColor must be called with a named candidate");
      }
      if (candidate.value.kind !== "named") {
        throw new Error("resolveThemeColor must be called with a named value");
      }
    }
    let value2 = null;
    switch (candidate.value.value) {
      case "inherit": {
        value2 = "inherit";
        break;
      }
      case "transparent": {
        value2 = "transparent";
        break;
      }
      case "current": {
        value2 = "currentcolor";
        break;
      }
      default: {
        value2 = theme2.resolve(candidate.value.value, themeKeys);
        break;
      }
    }
    return value2 ? asColor(value2, candidate.modifier, theme2) : null;
  }
  var LEGACY_NUMERIC_KEY = /(\d+)_(\d+)/g;
  function createUtilities(theme2) {
    let utilities2 = new Utilities();
    function suggest(classRoot, defns) {
      function* resolve(themeKeys) {
        for (let value2 of theme2.keysInNamespaces(themeKeys)) {
          yield value2.replace(LEGACY_NUMERIC_KEY, (_, a, b) => {
            return `${a}.${b}`;
          });
        }
      }
      let suggestedFractions = [
        "1/2",
        "1/3",
        "2/3",
        "1/4",
        "2/4",
        "3/4",
        "1/5",
        "2/5",
        "3/5",
        "4/5",
        "1/6",
        "2/6",
        "3/6",
        "4/6",
        "5/6",
        "1/12",
        "2/12",
        "3/12",
        "4/12",
        "5/12",
        "6/12",
        "7/12",
        "8/12",
        "9/12",
        "10/12",
        "11/12"
      ];
      utilities2.suggest(classRoot, () => {
        let groups = [];
        for (let defn of defns()) {
          if (typeof defn === "string") {
            groups.push({ values: [defn], modifiers: [] });
            continue;
          }
          let values = [
            ...defn.values ?? [],
            ...resolve(defn.valueThemeKeys ?? [])
          ];
          let modifiers = [...defn.modifiers ?? [], ...resolve(defn.modifierThemeKeys ?? [])];
          if (defn.supportsFractions) {
            values.push(...suggestedFractions);
          }
          if (defn.hasDefaultValue) {
            values.unshift(null);
          }
          groups.push({ supportsNegative: defn.supportsNegative, values, modifiers });
        }
        return groups;
      });
    }
    function staticUtility(className, declarations) {
      utilities2.static(className, () => {
        return declarations.map((node) => {
          return typeof node === "function" ? node() : decl(node[0], node[1]);
        });
      });
    }
    function functionalUtility(classRoot, desc) {
      if (desc.staticValues) desc.staticValues = Object.assign(/* @__PURE__ */ Object.create(null), desc.staticValues);
      function handleFunctionalUtility({ negative }) {
        return (candidate) => {
          let value2 = null;
          let dataType = null;
          if (!candidate.value) {
            if (candidate.modifier) return;
            value2 = desc.defaultValue !== void 0 ? desc.defaultValue : theme2.resolve(null, desc.themeKeys ?? []);
          } else if (candidate.value.kind === "arbitrary") {
            if (candidate.modifier) return;
            value2 = candidate.value.value;
            dataType = candidate.value.dataType;
          } else {
            value2 = theme2.resolve(
              candidate.value.fraction ?? candidate.value.value,
              desc.themeKeys ?? []
            );
            if (value2 !== null && candidate.modifier && !candidate.value.fraction) return;
            if (value2 === null && desc.supportsFractions && candidate.value.fraction) {
              let [lhs, rhs] = segment(candidate.value.fraction, "/");
              if (!isPositiveInteger(lhs) || !isPositiveInteger(rhs)) return;
              value2 = `calc(${lhs} / ${rhs} * 100%)`;
            }
            if (value2 === null && negative && desc.handleNegativeBareValue) {
              value2 = desc.handleNegativeBareValue(candidate.value);
              if (!value2?.includes("/") && candidate.modifier) return;
              if (value2 !== null) return desc.handle(value2, null);
            }
            if (value2 === null && desc.handleBareValue) {
              value2 = desc.handleBareValue(candidate.value);
              if (!value2?.includes("/") && candidate.modifier) return;
            }
            if (value2 === null && !negative && desc.staticValues && !candidate.modifier) {
              let fallback = desc.staticValues[candidate.value.value];
              if (fallback) return fallback.map(cloneAstNode);
            }
          }
          if (value2 === null) return;
          return desc.handle(
            negative ? addWhitespaceAroundMathOperators(`calc(${value2} * -1)`) : value2,
            dataType
          );
        };
      }
      if (desc.supportsNegative) {
        utilities2.functional(`-${classRoot}`, handleFunctionalUtility({ negative: true }));
      }
      utilities2.functional(classRoot, handleFunctionalUtility({ negative: false }));
      suggest(classRoot, () => [
        {
          supportsNegative: desc.supportsNegative,
          valueThemeKeys: desc.themeKeys ?? [],
          hasDefaultValue: desc.defaultValue !== void 0 && desc.defaultValue !== null,
          supportsFractions: desc.supportsFractions
        }
      ]);
      if (desc.staticValues && Object.keys(desc.staticValues).length > 0) {
        let values = Object.keys(desc.staticValues);
        suggest(classRoot, () => [{ values }]);
      }
    }
    function colorUtility(classRoot, desc) {
      utilities2.functional(classRoot, (candidate) => {
        if (!candidate.value) return;
        let value2 = null;
        if (candidate.value.kind === "arbitrary") {
          value2 = candidate.value.value;
          value2 = asColor(value2, candidate.modifier, theme2);
        } else {
          value2 = resolveThemeColor(candidate, theme2, desc.themeKeys);
        }
        if (value2 === null) return;
        return desc.handle(value2);
      });
      suggest(classRoot, () => [
        {
          values: ["current", "inherit", "transparent"],
          valueThemeKeys: desc.themeKeys,
          modifierThemeKeys: ["--opacity"],
          modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
        }
      ]);
    }
    function spacingUtility(name, themeKeys, handle, {
      supportsNegative = false,
      supportsFractions = false,
      staticValues
    } = {}) {
      if (supportsNegative) {
        utilities2.static(`-${name}-px`, () => handle("-1px"));
      }
      utilities2.static(`${name}-px`, () => handle("1px"));
      functionalUtility(name, {
        themeKeys,
        supportsFractions,
        supportsNegative,
        defaultValue: null,
        handleBareValue: ({ value: value2 }) => {
          let multiplier = theme2.resolve(null, ["--spacing"]);
          if (!multiplier) return null;
          if (!isValidSpacingMultiplier(value2)) return null;
          return `--spacing(${value2})`;
        },
        handleNegativeBareValue: ({ value: value2 }) => {
          let multiplier = theme2.resolve(null, ["--spacing"]);
          if (!multiplier) return null;
          if (!isValidSpacingMultiplier(value2)) return null;
          return `--spacing(-${value2})`;
        },
        handle,
        staticValues
      });
      suggest(name, () => [
        {
          values: theme2.get(["--spacing"]) ? DEFAULT_SPACING_SUGGESTIONS : [],
          supportsNegative,
          supportsFractions,
          valueThemeKeys: themeKeys
        }
      ]);
    }
    staticUtility("sr-only", [
      ["position", "absolute"],
      ["width", "1px"],
      ["height", "1px"],
      ["padding", "0"],
      ["margin", "-1px"],
      ["overflow", "hidden"],
      ["clip-path", "inset(50%)"],
      ["white-space", "nowrap"],
      ["border-width", "0"]
    ]);
    staticUtility("not-sr-only", [
      ["position", "static"],
      ["width", "auto"],
      ["height", "auto"],
      ["padding", "0"],
      ["margin", "0"],
      ["overflow", "visible"],
      ["clip-path", "none"],
      ["white-space", "normal"]
    ]);
    staticUtility("pointer-events-none", [["pointer-events", "none"]]);
    staticUtility("pointer-events-auto", [["pointer-events", "auto"]]);
    staticUtility("visible", [["visibility", "visible"]]);
    staticUtility("invisible", [["visibility", "hidden"]]);
    staticUtility("collapse", [["visibility", "collapse"]]);
    staticUtility("static", [["position", "static"]]);
    staticUtility("fixed", [["position", "fixed"]]);
    staticUtility("absolute", [["position", "absolute"]]);
    staticUtility("relative", [["position", "relative"]]);
    staticUtility("sticky", [["position", "sticky"]]);
    for (let [name, property2] of [
      ["inset", "inset"],
      ["inset-x", "inset-inline"],
      ["inset-y", "inset-block"],
      ["inset-s", "inset-inline-start"],
      ["inset-e", "inset-inline-end"],
      ["inset-bs", "inset-block-start"],
      ["inset-be", "inset-block-end"],
      ["top", "top"],
      ["right", "right"],
      ["bottom", "bottom"],
      ["left", "left"]
    ]) {
      staticUtility(`${name}-auto`, [[property2, "auto"]]);
      staticUtility(`${name}-full`, [[property2, "100%"]]);
      staticUtility(`-${name}-full`, [[property2, "-100%"]]);
      spacingUtility(name, ["--inset", "--spacing"], (value2) => [decl(property2, value2)], {
        supportsNegative: true,
        supportsFractions: true
      });
    }
    staticUtility("isolate", [["isolation", "isolate"]]);
    staticUtility("isolation-auto", [["isolation", "auto"]]);
    functionalUtility("z", {
      supportsNegative: true,
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      themeKeys: ["--z-index"],
      handle: (value2) => [decl("z-index", value2)],
      staticValues: {
        auto: [decl("z-index", "auto")]
      }
    });
    suggest("z", () => [
      {
        supportsNegative: true,
        values: ["0", "10", "20", "30", "40", "50"],
        valueThemeKeys: ["--z-index"]
      }
    ]);
    functionalUtility("order", {
      supportsNegative: true,
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      themeKeys: ["--order"],
      handle: (value2) => [decl("order", value2)],
      staticValues: {
        first: [decl("order", "-9999")],
        last: [decl("order", "9999")]
      }
    });
    suggest("order", () => [
      {
        supportsNegative: true,
        values: Array.from({ length: 12 }, (_, i) => `${i + 1}`),
        valueThemeKeys: ["--order"]
      }
    ]);
    functionalUtility("col", {
      supportsNegative: true,
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      themeKeys: ["--grid-column"],
      handle: (value2) => [decl("grid-column", value2)],
      staticValues: {
        auto: [decl("grid-column", "auto")]
      }
    });
    functionalUtility("col-span", {
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      handle: (value2) => [decl("grid-column", `span ${value2} / span ${value2}`)],
      staticValues: {
        full: [decl("grid-column", "1 / -1")]
      }
    });
    functionalUtility("col-start", {
      supportsNegative: true,
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      themeKeys: ["--grid-column-start"],
      handle: (value2) => [decl("grid-column-start", value2)],
      staticValues: {
        auto: [decl("grid-column-start", "auto")]
      }
    });
    functionalUtility("col-end", {
      supportsNegative: true,
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      themeKeys: ["--grid-column-end"],
      handle: (value2) => [decl("grid-column-end", value2)],
      staticValues: {
        auto: [decl("grid-column-end", "auto")]
      }
    });
    suggest("col-span", () => [
      {
        values: Array.from({ length: 12 }, (_, i) => `${i + 1}`),
        valueThemeKeys: []
      }
    ]);
    suggest("col-start", () => [
      {
        supportsNegative: true,
        values: Array.from({ length: 13 }, (_, i) => `${i + 1}`),
        valueThemeKeys: ["--grid-column-start"]
      }
    ]);
    suggest("col-end", () => [
      {
        supportsNegative: true,
        values: Array.from({ length: 13 }, (_, i) => `${i + 1}`),
        valueThemeKeys: ["--grid-column-end"]
      }
    ]);
    functionalUtility("row", {
      supportsNegative: true,
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      themeKeys: ["--grid-row"],
      handle: (value2) => [decl("grid-row", value2)],
      staticValues: {
        auto: [decl("grid-row", "auto")]
      }
    });
    functionalUtility("row-span", {
      themeKeys: [],
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      handle: (value2) => [decl("grid-row", `span ${value2} / span ${value2}`)],
      staticValues: {
        full: [decl("grid-row", "1 / -1")]
      }
    });
    functionalUtility("row-start", {
      supportsNegative: true,
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      themeKeys: ["--grid-row-start"],
      handle: (value2) => [decl("grid-row-start", value2)],
      staticValues: {
        auto: [decl("grid-row-start", "auto")]
      }
    });
    functionalUtility("row-end", {
      supportsNegative: true,
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      themeKeys: ["--grid-row-end"],
      handle: (value2) => [decl("grid-row-end", value2)],
      staticValues: {
        auto: [decl("grid-row-end", "auto")]
      }
    });
    suggest("row-span", () => [
      {
        values: Array.from({ length: 12 }, (_, i) => `${i + 1}`),
        valueThemeKeys: []
      }
    ]);
    suggest("row-start", () => [
      {
        supportsNegative: true,
        values: Array.from({ length: 13 }, (_, i) => `${i + 1}`),
        valueThemeKeys: ["--grid-row-start"]
      }
    ]);
    suggest("row-end", () => [
      {
        supportsNegative: true,
        values: Array.from({ length: 13 }, (_, i) => `${i + 1}`),
        valueThemeKeys: ["--grid-row-end"]
      }
    ]);
    staticUtility("float-start", [["float", "inline-start"]]);
    staticUtility("float-end", [["float", "inline-end"]]);
    staticUtility("float-right", [["float", "right"]]);
    staticUtility("float-left", [["float", "left"]]);
    staticUtility("float-none", [["float", "none"]]);
    staticUtility("clear-start", [["clear", "inline-start"]]);
    staticUtility("clear-end", [["clear", "inline-end"]]);
    staticUtility("clear-right", [["clear", "right"]]);
    staticUtility("clear-left", [["clear", "left"]]);
    staticUtility("clear-both", [["clear", "both"]]);
    staticUtility("clear-none", [["clear", "none"]]);
    for (let [namespace, property2] of [
      ["m", "margin"],
      ["mx", "margin-inline"],
      ["my", "margin-block"],
      ["ms", "margin-inline-start"],
      ["me", "margin-inline-end"],
      ["mbs", "margin-block-start"],
      ["mbe", "margin-block-end"],
      ["mt", "margin-top"],
      ["mr", "margin-right"],
      ["mb", "margin-bottom"],
      ["ml", "margin-left"]
    ]) {
      staticUtility(`${namespace}-auto`, [[property2, "auto"]]);
      spacingUtility(namespace, ["--margin", "--spacing"], (value2) => [decl(property2, value2)], {
        supportsNegative: true
      });
    }
    staticUtility("box-border", [["box-sizing", "border-box"]]);
    staticUtility("box-content", [["box-sizing", "content-box"]]);
    functionalUtility("line-clamp", {
      themeKeys: ["--line-clamp"],
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      handle: (value2) => [
        decl("overflow", "hidden"),
        decl("display", "-webkit-box"),
        decl("-webkit-box-orient", "vertical"),
        decl("-webkit-line-clamp", value2)
      ],
      staticValues: {
        none: [
          decl("overflow", "visible"),
          decl("display", "block"),
          decl("-webkit-box-orient", "horizontal"),
          decl("-webkit-line-clamp", "unset")
        ]
      }
    });
    suggest("line-clamp", () => [
      {
        values: ["1", "2", "3", "4", "5", "6"],
        valueThemeKeys: ["--line-clamp"]
      }
    ]);
    staticUtility("block", [["display", "block"]]);
    staticUtility("inline-block", [["display", "inline-block"]]);
    staticUtility("inline", [["display", "inline"]]);
    staticUtility("hidden", [["display", "none"]]);
    staticUtility("inline-flex", [["display", "inline-flex"]]);
    staticUtility("table", [["display", "table"]]);
    staticUtility("inline-table", [["display", "inline-table"]]);
    staticUtility("table-caption", [["display", "table-caption"]]);
    staticUtility("table-cell", [["display", "table-cell"]]);
    staticUtility("table-column", [["display", "table-column"]]);
    staticUtility("table-column-group", [["display", "table-column-group"]]);
    staticUtility("table-footer-group", [["display", "table-footer-group"]]);
    staticUtility("table-header-group", [["display", "table-header-group"]]);
    staticUtility("table-row-group", [["display", "table-row-group"]]);
    staticUtility("table-row", [["display", "table-row"]]);
    staticUtility("flow-root", [["display", "flow-root"]]);
    staticUtility("flex", [["display", "flex"]]);
    staticUtility("grid", [["display", "grid"]]);
    staticUtility("inline-grid", [["display", "inline-grid"]]);
    staticUtility("contents", [["display", "contents"]]);
    staticUtility("list-item", [["display", "list-item"]]);
    staticUtility("field-sizing-content", [["field-sizing", "content"]]);
    staticUtility("field-sizing-fixed", [["field-sizing", "fixed"]]);
    functionalUtility("aspect", {
      themeKeys: ["--aspect"],
      handleBareValue: ({ fraction }) => {
        if (fraction === null) return null;
        let [lhs, rhs] = segment(fraction, "/");
        if (!isValidSpacingMultiplier(lhs) || !isValidSpacingMultiplier(rhs)) return null;
        return fraction;
      },
      handle: (value2) => [decl("aspect-ratio", value2)],
      staticValues: {
        auto: [decl("aspect-ratio", "auto")],
        square: [decl("aspect-ratio", "1 / 1")]
      }
    });
    for (let [key, value2] of [
      ["full", "100%"],
      ["svw", "100svw"],
      ["lvw", "100lvw"],
      ["dvw", "100dvw"],
      ["svh", "100svh"],
      ["lvh", "100lvh"],
      ["dvh", "100dvh"],
      ["min", "min-content"],
      ["max", "max-content"],
      ["fit", "fit-content"]
    ]) {
      staticUtility(`size-${key}`, [
        ["--tw-sort", "size"],
        ["width", value2],
        ["height", value2]
      ]);
      staticUtility(`w-${key}`, [["width", value2]]);
      staticUtility(`h-${key}`, [["height", value2]]);
      staticUtility(`min-w-${key}`, [["min-width", value2]]);
      staticUtility(`min-h-${key}`, [["min-height", value2]]);
      staticUtility(`max-w-${key}`, [["max-width", value2]]);
      staticUtility(`max-h-${key}`, [["max-height", value2]]);
    }
    staticUtility(`size-auto`, [
      ["--tw-sort", "size"],
      ["width", "auto"],
      ["height", "auto"]
    ]);
    staticUtility(`w-auto`, [["width", "auto"]]);
    staticUtility(`h-auto`, [["height", "auto"]]);
    staticUtility(`min-w-auto`, [["min-width", "auto"]]);
    staticUtility(`min-h-auto`, [["min-height", "auto"]]);
    staticUtility(`h-lh`, [["height", "1lh"]]);
    staticUtility(`min-h-lh`, [["min-height", "1lh"]]);
    staticUtility(`max-h-lh`, [["max-height", "1lh"]]);
    staticUtility(`w-screen`, [["width", "100vw"]]);
    staticUtility(`min-w-screen`, [["min-width", "100vw"]]);
    staticUtility(`max-w-screen`, [["max-width", "100vw"]]);
    staticUtility(`h-screen`, [["height", "100vh"]]);
    staticUtility(`min-h-screen`, [["min-height", "100vh"]]);
    staticUtility(`max-h-screen`, [["max-height", "100vh"]]);
    staticUtility(`max-w-none`, [["max-width", "none"]]);
    staticUtility(`max-h-none`, [["max-height", "none"]]);
    spacingUtility(
      "size",
      ["--size", "--spacing"],
      (value2) => [decl("--tw-sort", "size"), decl("width", value2), decl("height", value2)],
      {
        supportsFractions: true
      }
    );
    for (let [name, namespaces, property2] of [
      ["w", ["--width", "--spacing", "--container"], "width"],
      ["min-w", ["--min-width", "--spacing", "--container"], "min-width"],
      ["max-w", ["--max-width", "--spacing", "--container"], "max-width"],
      ["h", ["--height", "--spacing"], "height"],
      ["min-h", ["--min-height", "--height", "--spacing"], "min-height"],
      ["max-h", ["--max-height", "--height", "--spacing"], "max-height"]
    ]) {
      spacingUtility(name, namespaces, (value2) => [decl(property2, value2)], {
        supportsFractions: true
      });
    }
    for (let [key, value2] of [
      ["full", "100%"],
      ["min", "min-content"],
      ["max", "max-content"],
      ["fit", "fit-content"]
    ]) {
      staticUtility(`inline-${key}`, [["inline-size", value2]]);
      staticUtility(`block-${key}`, [["block-size", value2]]);
      staticUtility(`min-inline-${key}`, [["min-inline-size", value2]]);
      staticUtility(`min-block-${key}`, [["min-block-size", value2]]);
      staticUtility(`max-inline-${key}`, [["max-inline-size", value2]]);
      staticUtility(`max-block-${key}`, [["max-block-size", value2]]);
    }
    for (let [key, value2] of [
      ["svw", "100svw"],
      ["lvw", "100lvw"],
      ["dvw", "100dvw"]
    ]) {
      staticUtility(`inline-${key}`, [["inline-size", value2]]);
      staticUtility(`min-inline-${key}`, [["min-inline-size", value2]]);
      staticUtility(`max-inline-${key}`, [["max-inline-size", value2]]);
    }
    for (let [key, value2] of [
      ["svh", "100svh"],
      ["lvh", "100lvh"],
      ["dvh", "100dvh"]
    ]) {
      staticUtility(`block-${key}`, [["block-size", value2]]);
      staticUtility(`min-block-${key}`, [["min-block-size", value2]]);
      staticUtility(`max-block-${key}`, [["max-block-size", value2]]);
    }
    staticUtility(`inline-auto`, [["inline-size", "auto"]]);
    staticUtility(`block-auto`, [["block-size", "auto"]]);
    staticUtility(`min-inline-auto`, [["min-inline-size", "auto"]]);
    staticUtility(`min-block-auto`, [["min-block-size", "auto"]]);
    staticUtility(`block-lh`, [["block-size", "1lh"]]);
    staticUtility(`min-block-lh`, [["min-block-size", "1lh"]]);
    staticUtility(`max-block-lh`, [["max-block-size", "1lh"]]);
    staticUtility(`inline-screen`, [["inline-size", "100vw"]]);
    staticUtility(`min-inline-screen`, [["min-inline-size", "100vw"]]);
    staticUtility(`max-inline-screen`, [["max-inline-size", "100vw"]]);
    staticUtility(`block-screen`, [["block-size", "100vh"]]);
    staticUtility(`min-block-screen`, [["min-block-size", "100vh"]]);
    staticUtility(`max-block-screen`, [["max-block-size", "100vh"]]);
    staticUtility(`max-inline-none`, [["max-inline-size", "none"]]);
    staticUtility(`max-block-none`, [["max-block-size", "none"]]);
    for (let [name, namespaces, property2] of [
      ["inline", ["--spacing", "--container"], "inline-size"],
      ["min-inline", ["--spacing", "--container"], "min-inline-size"],
      ["max-inline", ["--spacing", "--container"], "max-inline-size"],
      ["block", ["--spacing"], "block-size"],
      ["min-block", ["--spacing"], "min-block-size"],
      ["max-block", ["--spacing"], "max-block-size"]
    ]) {
      spacingUtility(name, namespaces, (value2) => [decl(property2, value2)], {
        supportsFractions: true
      });
    }
    utilities2.static("container", () => {
      let breakpoints = [...theme2.namespace("--breakpoint").values()];
      breakpoints.sort((a, z) => compareBreakpoints(a, z, "asc"));
      let decls = [decl("--tw-sort", "--tw-container-component"), decl("width", "100%")];
      for (let breakpoint of breakpoints) {
        decls.push(atRule("@media", `(width >= ${breakpoint})`, [decl("max-width", breakpoint)]));
      }
      return decls;
    });
    staticUtility("flex-auto", [["flex", "auto"]]);
    staticUtility("flex-initial", [["flex", "0 auto"]]);
    staticUtility("flex-none", [["flex", "none"]]);
    utilities2.functional("flex", (candidate) => {
      if (!candidate.value) return;
      if (candidate.value.kind === "arbitrary") {
        if (candidate.modifier) return;
        return [decl("flex", candidate.value.value)];
      }
      if (candidate.value.fraction) {
        let [lhs, rhs] = segment(candidate.value.fraction, "/");
        if (!isPositiveInteger(lhs) || !isPositiveInteger(rhs)) return;
        return [decl("flex", `calc(${candidate.value.fraction} * 100%)`)];
      }
      if (isPositiveInteger(candidate.value.value)) {
        if (candidate.modifier) return;
        return [decl("flex", candidate.value.value)];
      }
    });
    suggest("flex", () => [
      { supportsFractions: true },
      { values: Array.from({ length: 12 }, (_, i) => `${i + 1}`) }
    ]);
    functionalUtility("shrink", {
      defaultValue: "1",
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      handle: (value2) => [decl("flex-shrink", value2)]
    });
    functionalUtility("grow", {
      defaultValue: "1",
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      handle: (value2) => [decl("flex-grow", value2)]
    });
    suggest("shrink", () => [
      {
        values: ["0"],
        valueThemeKeys: [],
        hasDefaultValue: true
      }
    ]);
    suggest("grow", () => [
      {
        values: ["0"],
        valueThemeKeys: [],
        hasDefaultValue: true
      }
    ]);
    staticUtility("basis-auto", [["flex-basis", "auto"]]);
    staticUtility("basis-full", [["flex-basis", "100%"]]);
    spacingUtility(
      "basis",
      ["--flex-basis", "--spacing", "--container"],
      (value2) => [decl("flex-basis", value2)],
      {
        supportsFractions: true
      }
    );
    staticUtility("table-auto", [["table-layout", "auto"]]);
    staticUtility("table-fixed", [["table-layout", "fixed"]]);
    staticUtility("caption-top", [["caption-side", "top"]]);
    staticUtility("caption-bottom", [["caption-side", "bottom"]]);
    staticUtility("border-collapse", [["border-collapse", "collapse"]]);
    staticUtility("border-separate", [["border-collapse", "separate"]]);
    let borderSpacingProperties = () => atRoot([
      property("--tw-border-spacing-x", "0", "<length>"),
      property("--tw-border-spacing-y", "0", "<length>")
    ]);
    spacingUtility("border-spacing", ["--border-spacing", "--spacing"], (value2) => [
      borderSpacingProperties(),
      decl("--tw-border-spacing-x", value2),
      decl("--tw-border-spacing-y", value2),
      decl("border-spacing", "var(--tw-border-spacing-x) var(--tw-border-spacing-y)")
    ]);
    spacingUtility("border-spacing-x", ["--border-spacing", "--spacing"], (value2) => [
      borderSpacingProperties(),
      decl("--tw-border-spacing-x", value2),
      decl("border-spacing", "var(--tw-border-spacing-x) var(--tw-border-spacing-y)")
    ]);
    spacingUtility("border-spacing-y", ["--border-spacing", "--spacing"], (value2) => [
      borderSpacingProperties(),
      decl("--tw-border-spacing-y", value2),
      decl("border-spacing", "var(--tw-border-spacing-x) var(--tw-border-spacing-y)")
    ]);
    functionalUtility("origin", {
      themeKeys: ["--transform-origin"],
      handle: (value2) => [decl("transform-origin", value2)],
      staticValues: {
        center: [decl("transform-origin", "center")],
        top: [decl("transform-origin", "top")],
        "top-right": [decl("transform-origin", "100% 0")],
        right: [decl("transform-origin", "100%")],
        "bottom-right": [decl("transform-origin", "100% 100%")],
        bottom: [decl("transform-origin", "bottom")],
        "bottom-left": [decl("transform-origin", "0 100%")],
        left: [decl("transform-origin", "0")],
        "top-left": [decl("transform-origin", "0 0")]
      }
    });
    functionalUtility("perspective-origin", {
      themeKeys: ["--perspective-origin"],
      handle: (value2) => [decl("perspective-origin", value2)],
      staticValues: {
        center: [decl("perspective-origin", "center")],
        top: [decl("perspective-origin", "top")],
        "top-right": [decl("perspective-origin", "100% 0")],
        right: [decl("perspective-origin", "100%")],
        "bottom-right": [decl("perspective-origin", "100% 100%")],
        bottom: [decl("perspective-origin", "bottom")],
        "bottom-left": [decl("perspective-origin", "0 100%")],
        left: [decl("perspective-origin", "0")],
        "top-left": [decl("perspective-origin", "0 0")]
      }
    });
    functionalUtility("perspective", {
      themeKeys: ["--perspective"],
      handle: (value2) => [decl("perspective", value2)],
      staticValues: {
        none: [decl("perspective", "none")]
      }
    });
    let translateProperties = () => atRoot([
      property("--tw-translate-x", "0"),
      property("--tw-translate-y", "0"),
      property("--tw-translate-z", "0")
    ]);
    staticUtility("translate-none", [["translate", "none"]]);
    staticUtility("-translate-full", [
      translateProperties,
      ["--tw-translate-x", "-100%"],
      ["--tw-translate-y", "-100%"],
      ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]
    ]);
    staticUtility("translate-full", [
      translateProperties,
      ["--tw-translate-x", "100%"],
      ["--tw-translate-y", "100%"],
      ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]
    ]);
    spacingUtility(
      "translate",
      ["--translate", "--spacing"],
      (value2) => [
        translateProperties(),
        decl("--tw-translate-x", value2),
        decl("--tw-translate-y", value2),
        decl("translate", "var(--tw-translate-x) var(--tw-translate-y)")
      ],
      { supportsNegative: true, supportsFractions: true }
    );
    for (let axis of ["x", "y"]) {
      staticUtility(`-translate-${axis}-full`, [
        translateProperties,
        [`--tw-translate-${axis}`, "-100%"],
        ["translate", `var(--tw-translate-x) var(--tw-translate-y)`]
      ]);
      staticUtility(`translate-${axis}-full`, [
        translateProperties,
        [`--tw-translate-${axis}`, "100%"],
        ["translate", `var(--tw-translate-x) var(--tw-translate-y)`]
      ]);
      spacingUtility(
        `translate-${axis}`,
        ["--translate", "--spacing"],
        (value2) => [
          translateProperties(),
          decl(`--tw-translate-${axis}`, value2),
          decl("translate", `var(--tw-translate-x) var(--tw-translate-y)`)
        ],
        {
          supportsNegative: true,
          supportsFractions: true
        }
      );
    }
    spacingUtility(
      `translate-z`,
      ["--translate", "--spacing"],
      (value2) => [
        translateProperties(),
        decl(`--tw-translate-z`, value2),
        decl("translate", "var(--tw-translate-x) var(--tw-translate-y) var(--tw-translate-z)")
      ],
      {
        supportsNegative: true
      }
    );
    staticUtility("translate-3d", [
      translateProperties,
      ["translate", "var(--tw-translate-x) var(--tw-translate-y) var(--tw-translate-z)"]
    ]);
    let scaleProperties = () => atRoot([
      property("--tw-scale-x", "1"),
      property("--tw-scale-y", "1"),
      property("--tw-scale-z", "1")
    ]);
    staticUtility("scale-none", [["scale", "none"]]);
    function handleScale({ negative }) {
      return (candidate) => {
        if (!candidate.value || candidate.modifier) return;
        let value2;
        if (candidate.value.kind === "arbitrary") {
          value2 = candidate.value.value;
          value2 = negative ? `calc(${value2} * -1)` : value2;
          return [decl("scale", value2)];
        } else {
          value2 = theme2.resolve(candidate.value.value, ["--scale"]);
          if (!value2 && isPositiveInteger(candidate.value.value)) {
            value2 = `${candidate.value.value}%`;
          }
          if (!value2) return;
        }
        value2 = negative ? `calc(${value2} * -1)` : value2;
        return [
          scaleProperties(),
          decl("--tw-scale-x", value2),
          decl("--tw-scale-y", value2),
          decl("--tw-scale-z", value2),
          decl("scale", `var(--tw-scale-x) var(--tw-scale-y)`)
        ];
      };
    }
    utilities2.functional("-scale", handleScale({ negative: true }));
    utilities2.functional("scale", handleScale({ negative: false }));
    suggest("scale", () => [
      {
        supportsNegative: true,
        values: ["0", "50", "75", "90", "95", "100", "105", "110", "125", "150", "200"],
        valueThemeKeys: ["--scale"]
      }
    ]);
    for (let axis of ["x", "y", "z"]) {
      functionalUtility(`scale-${axis}`, {
        supportsNegative: true,
        themeKeys: ["--scale"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}%`;
        },
        handle: (value2) => [
          scaleProperties(),
          decl(`--tw-scale-${axis}`, value2),
          decl(
            "scale",
            `var(--tw-scale-x) var(--tw-scale-y)${axis === "z" ? " var(--tw-scale-z)" : ""}`
          )
        ]
      });
      suggest(`scale-${axis}`, () => [
        {
          supportsNegative: true,
          values: ["0", "50", "75", "90", "95", "100", "105", "110", "125", "150", "200"],
          valueThemeKeys: ["--scale"]
        }
      ]);
    }
    staticUtility("scale-3d", [
      scaleProperties,
      ["scale", "var(--tw-scale-x) var(--tw-scale-y) var(--tw-scale-z)"]
    ]);
    staticUtility("rotate-none", [["rotate", "none"]]);
    function handleRotate({ negative }) {
      return (candidate) => {
        if (!candidate.value || candidate.modifier) return;
        let value2;
        if (candidate.value.kind === "arbitrary") {
          value2 = candidate.value.value;
          let type = candidate.value.dataType ?? inferDataType(value2, ["angle", "vector"]);
          if (type === "vector") {
            return [decl("rotate", `${value2} var(--tw-rotate)`)];
          } else if (type !== "angle") {
            return [decl("rotate", negative ? `calc(${value2} * -1)` : value2)];
          }
        } else {
          value2 = theme2.resolve(candidate.value.value, ["--rotate"]);
          if (!value2 && isPositiveInteger(candidate.value.value)) {
            value2 = `${candidate.value.value}deg`;
          }
          if (!value2) return;
        }
        return [decl("rotate", negative ? `calc(${value2} * -1)` : value2)];
      };
    }
    utilities2.functional("-rotate", handleRotate({ negative: true }));
    utilities2.functional("rotate", handleRotate({ negative: false }));
    suggest("rotate", () => [
      {
        supportsNegative: true,
        values: ["0", "1", "2", "3", "6", "12", "45", "90", "180"],
        valueThemeKeys: ["--rotate"]
      }
    ]);
    {
      let transformValue = [
        "var(--tw-rotate-x, )",
        "var(--tw-rotate-y, )",
        "var(--tw-rotate-z, )",
        "var(--tw-skew-x, )",
        "var(--tw-skew-y, )"
      ].join(" ");
      let transformProperties = () => atRoot([
        property("--tw-rotate-x"),
        property("--tw-rotate-y"),
        property("--tw-rotate-z"),
        property("--tw-skew-x"),
        property("--tw-skew-y")
      ]);
      for (let axis of ["x", "y", "z"]) {
        functionalUtility(`rotate-${axis}`, {
          supportsNegative: true,
          themeKeys: ["--rotate"],
          handleBareValue: ({ value: value2 }) => {
            if (!isPositiveInteger(value2)) return null;
            return `${value2}deg`;
          },
          handle: (value2) => [
            transformProperties(),
            decl(`--tw-rotate-${axis}`, `rotate${axis.toUpperCase()}(${value2})`),
            decl("transform", transformValue)
          ]
        });
        suggest(`rotate-${axis}`, () => [
          {
            supportsNegative: true,
            values: ["0", "1", "2", "3", "6", "12", "45", "90", "180"],
            valueThemeKeys: ["--rotate"]
          }
        ]);
      }
      functionalUtility("skew", {
        supportsNegative: true,
        themeKeys: ["--skew"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}deg`;
        },
        handle: (value2) => [
          transformProperties(),
          decl("--tw-skew-x", `skewX(${value2})`),
          decl("--tw-skew-y", `skewY(${value2})`),
          decl("transform", transformValue)
        ]
      });
      functionalUtility("skew-x", {
        supportsNegative: true,
        themeKeys: ["--skew"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}deg`;
        },
        handle: (value2) => [
          transformProperties(),
          decl("--tw-skew-x", `skewX(${value2})`),
          decl("transform", transformValue)
        ]
      });
      functionalUtility("skew-y", {
        supportsNegative: true,
        themeKeys: ["--skew"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}deg`;
        },
        handle: (value2) => [
          transformProperties(),
          decl("--tw-skew-y", `skewY(${value2})`),
          decl("transform", transformValue)
        ]
      });
      suggest("skew", () => [
        {
          supportsNegative: true,
          values: ["0", "1", "2", "3", "6", "12"],
          valueThemeKeys: ["--skew"]
        }
      ]);
      suggest("skew-x", () => [
        {
          supportsNegative: true,
          values: ["0", "1", "2", "3", "6", "12"],
          valueThemeKeys: ["--skew"]
        }
      ]);
      suggest("skew-y", () => [
        {
          supportsNegative: true,
          values: ["0", "1", "2", "3", "6", "12"],
          valueThemeKeys: ["--skew"]
        }
      ]);
      utilities2.functional("transform", (candidate) => {
        if (candidate.modifier) return;
        let value2 = null;
        if (!candidate.value) {
          value2 = transformValue;
        } else if (candidate.value.kind === "arbitrary") {
          value2 = candidate.value.value;
        }
        if (value2 === null) return;
        return [transformProperties(), decl("transform", value2)];
      });
      suggest("transform", () => [
        {
          hasDefaultValue: true
        }
      ]);
      staticUtility("transform-cpu", [["transform", transformValue]]);
      staticUtility("transform-gpu", [["transform", `translateZ(0) ${transformValue}`]]);
      staticUtility("transform-none", [["transform", "none"]]);
    }
    functionalUtility("zoom", {
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return `${value2}%`;
      },
      handle: (value2) => [decl("zoom", value2)]
    });
    suggest("zoom", () => [
      { values: ["50", "75", "90", "95", "100", "105", "110", "125", "150", "200"] }
    ]);
    staticUtility("transform-flat", [["transform-style", "flat"]]);
    staticUtility("transform-3d", [["transform-style", "preserve-3d"]]);
    staticUtility("transform-content", [["transform-box", "content-box"]]);
    staticUtility("transform-border", [["transform-box", "border-box"]]);
    staticUtility("transform-fill", [["transform-box", "fill-box"]]);
    staticUtility("transform-stroke", [["transform-box", "stroke-box"]]);
    staticUtility("transform-view", [["transform-box", "view-box"]]);
    staticUtility("backface-visible", [["backface-visibility", "visible"]]);
    staticUtility("backface-hidden", [["backface-visibility", "hidden"]]);
    for (let value2 of [
      "auto",
      "default",
      "pointer",
      "wait",
      "text",
      "move",
      "help",
      "not-allowed",
      "none",
      "context-menu",
      "progress",
      "cell",
      "crosshair",
      "vertical-text",
      "alias",
      "copy",
      "no-drop",
      "grab",
      "grabbing",
      "all-scroll",
      "col-resize",
      "row-resize",
      "n-resize",
      "e-resize",
      "s-resize",
      "w-resize",
      "ne-resize",
      "nw-resize",
      "se-resize",
      "sw-resize",
      "ew-resize",
      "ns-resize",
      "nesw-resize",
      "nwse-resize",
      "zoom-in",
      "zoom-out"
    ]) {
      staticUtility(`cursor-${value2}`, [["cursor", value2]]);
    }
    functionalUtility("cursor", {
      themeKeys: ["--cursor"],
      handle: (value2) => [decl("cursor", value2)]
    });
    for (let value2 of ["auto", "none", "manipulation"]) {
      staticUtility(`touch-${value2}`, [["touch-action", value2]]);
    }
    let touchProperties = () => atRoot([property("--tw-pan-x"), property("--tw-pan-y"), property("--tw-pinch-zoom")]);
    for (let value2 of ["x", "left", "right"]) {
      staticUtility(`touch-pan-${value2}`, [
        touchProperties,
        ["--tw-pan-x", `pan-${value2}`],
        ["touch-action", "var(--tw-pan-x, ) var(--tw-pan-y, ) var(--tw-pinch-zoom, )"]
      ]);
    }
    for (let value2 of ["y", "up", "down"]) {
      staticUtility(`touch-pan-${value2}`, [
        touchProperties,
        ["--tw-pan-y", `pan-${value2}`],
        ["touch-action", "var(--tw-pan-x, ) var(--tw-pan-y, ) var(--tw-pinch-zoom, )"]
      ]);
    }
    staticUtility("touch-pinch-zoom", [
      touchProperties,
      ["--tw-pinch-zoom", `pinch-zoom`],
      ["touch-action", "var(--tw-pan-x, ) var(--tw-pan-y, ) var(--tw-pinch-zoom, )"]
    ]);
    for (let value2 of ["none", "text", "all", "auto"]) {
      staticUtility(`select-${value2}`, [
        ["-webkit-user-select", value2],
        ["user-select", value2]
      ]);
    }
    staticUtility("resize-none", [["resize", "none"]]);
    staticUtility("resize-x", [["resize", "horizontal"]]);
    staticUtility("resize-y", [["resize", "vertical"]]);
    staticUtility("resize", [["resize", "both"]]);
    staticUtility("snap-none", [["scroll-snap-type", "none"]]);
    let snapProperties = () => atRoot([property("--tw-scroll-snap-strictness", "proximity", "*")]);
    for (let value2 of ["x", "y", "both"]) {
      staticUtility(`snap-${value2}`, [
        snapProperties,
        ["scroll-snap-type", `${value2} var(--tw-scroll-snap-strictness)`]
      ]);
    }
    staticUtility("snap-mandatory", [snapProperties, ["--tw-scroll-snap-strictness", "mandatory"]]);
    staticUtility("snap-proximity", [snapProperties, ["--tw-scroll-snap-strictness", "proximity"]]);
    staticUtility("snap-align-none", [["scroll-snap-align", "none"]]);
    staticUtility("snap-start", [["scroll-snap-align", "start"]]);
    staticUtility("snap-end", [["scroll-snap-align", "end"]]);
    staticUtility("snap-center", [["scroll-snap-align", "center"]]);
    staticUtility("snap-normal", [["scroll-snap-stop", "normal"]]);
    staticUtility("snap-always", [["scroll-snap-stop", "always"]]);
    for (let [namespace, property2] of [
      ["scroll-m", "scroll-margin"],
      ["scroll-mx", "scroll-margin-inline"],
      ["scroll-my", "scroll-margin-block"],
      ["scroll-ms", "scroll-margin-inline-start"],
      ["scroll-me", "scroll-margin-inline-end"],
      ["scroll-mbs", "scroll-margin-block-start"],
      ["scroll-mbe", "scroll-margin-block-end"],
      ["scroll-mt", "scroll-margin-top"],
      ["scroll-mr", "scroll-margin-right"],
      ["scroll-mb", "scroll-margin-bottom"],
      ["scroll-ml", "scroll-margin-left"]
    ]) {
      spacingUtility(
        namespace,
        ["--scroll-margin", "--spacing"],
        (value2) => [decl(property2, value2)],
        {
          supportsNegative: true
        }
      );
    }
    for (let [namespace, property2] of [
      ["scroll-p", "scroll-padding"],
      ["scroll-px", "scroll-padding-inline"],
      ["scroll-py", "scroll-padding-block"],
      ["scroll-ps", "scroll-padding-inline-start"],
      ["scroll-pe", "scroll-padding-inline-end"],
      ["scroll-pbs", "scroll-padding-block-start"],
      ["scroll-pbe", "scroll-padding-block-end"],
      ["scroll-pt", "scroll-padding-top"],
      ["scroll-pr", "scroll-padding-right"],
      ["scroll-pb", "scroll-padding-bottom"],
      ["scroll-pl", "scroll-padding-left"]
    ]) {
      spacingUtility(namespace, ["--scroll-padding", "--spacing"], (value2) => [decl(property2, value2)]);
    }
    staticUtility("list-inside", [["list-style-position", "inside"]]);
    staticUtility("list-outside", [["list-style-position", "outside"]]);
    functionalUtility("list", {
      themeKeys: ["--list-style-type"],
      handle: (value2) => [decl("list-style-type", value2)],
      staticValues: {
        none: [decl("list-style-type", "none")],
        disc: [decl("list-style-type", "disc")],
        decimal: [decl("list-style-type", "decimal")]
      }
    });
    functionalUtility("list-image", {
      themeKeys: ["--list-style-image"],
      handle: (value2) => [decl("list-style-image", value2)],
      staticValues: {
        none: [decl("list-style-image", "none")]
      }
    });
    staticUtility("appearance-none", [["appearance", "none"]]);
    staticUtility("appearance-auto", [["appearance", "auto"]]);
    staticUtility("scheme-normal", [["color-scheme", "normal"]]);
    staticUtility("scheme-dark", [["color-scheme", "dark"]]);
    staticUtility("scheme-light", [["color-scheme", "light"]]);
    staticUtility("scheme-light-dark", [["color-scheme", "light dark"]]);
    staticUtility("scheme-only-dark", [["color-scheme", "only dark"]]);
    staticUtility("scheme-only-light", [["color-scheme", "only light"]]);
    functionalUtility("columns", {
      themeKeys: ["--columns", "--container"],
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      handle: (value2) => [decl("columns", value2)],
      staticValues: {
        auto: [decl("columns", "auto")]
      }
    });
    suggest("columns", () => [
      {
        values: Array.from({ length: 12 }, (_, i) => `${i + 1}`),
        valueThemeKeys: ["--columns", "--container"]
      }
    ]);
    for (let value2 of ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"]) {
      staticUtility(`break-before-${value2}`, [["break-before", value2]]);
    }
    for (let value2 of ["auto", "avoid", "avoid-page", "avoid-column"]) {
      staticUtility(`break-inside-${value2}`, [["break-inside", value2]]);
    }
    for (let value2 of ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"]) {
      staticUtility(`break-after-${value2}`, [["break-after", value2]]);
    }
    staticUtility("grid-flow-row", [["grid-auto-flow", "row"]]);
    staticUtility("grid-flow-col", [["grid-auto-flow", "column"]]);
    staticUtility("grid-flow-dense", [["grid-auto-flow", "dense"]]);
    staticUtility("grid-flow-row-dense", [["grid-auto-flow", "row dense"]]);
    staticUtility("grid-flow-col-dense", [["grid-auto-flow", "column dense"]]);
    functionalUtility("auto-cols", {
      themeKeys: ["--grid-auto-columns"],
      handleBareValue: ({ value: value2 }) => {
        if (!theme2.resolve(null, ["--spacing"])) return null;
        if (!isValidSpacingMultiplier(value2)) return null;
        return `--spacing(${value2})`;
      },
      handle: (value2) => [decl("grid-auto-columns", value2)],
      staticValues: {
        auto: [decl("grid-auto-columns", "auto")],
        min: [decl("grid-auto-columns", "min-content")],
        max: [decl("grid-auto-columns", "max-content")],
        fr: [decl("grid-auto-columns", "minmax(0, 1fr)")]
      }
    });
    functionalUtility("auto-rows", {
      themeKeys: ["--grid-auto-rows"],
      handleBareValue: ({ value: value2 }) => {
        if (!theme2.resolve(null, ["--spacing"])) return null;
        if (!isValidSpacingMultiplier(value2)) return null;
        return `--spacing(${value2})`;
      },
      handle: (value2) => [decl("grid-auto-rows", value2)],
      staticValues: {
        auto: [decl("grid-auto-rows", "auto")],
        min: [decl("grid-auto-rows", "min-content")],
        max: [decl("grid-auto-rows", "max-content")],
        fr: [decl("grid-auto-rows", "minmax(0, 1fr)")]
      }
    });
    functionalUtility("grid-cols", {
      themeKeys: ["--grid-template-columns"],
      handleBareValue: ({ value: value2 }) => {
        if (!isStrictPositiveInteger(value2)) return null;
        return `repeat(${value2}, minmax(0, 1fr))`;
      },
      handle: (value2) => [decl("grid-template-columns", value2)],
      staticValues: {
        none: [decl("grid-template-columns", "none")],
        subgrid: [decl("grid-template-columns", "subgrid")]
      }
    });
    functionalUtility("grid-rows", {
      themeKeys: ["--grid-template-rows"],
      handleBareValue: ({ value: value2 }) => {
        if (!isStrictPositiveInteger(value2)) return null;
        return `repeat(${value2}, minmax(0, 1fr))`;
      },
      handle: (value2) => [decl("grid-template-rows", value2)],
      staticValues: {
        none: [decl("grid-template-rows", "none")],
        subgrid: [decl("grid-template-rows", "subgrid")]
      }
    });
    suggest("grid-cols", () => [
      {
        values: Array.from({ length: 12 }, (_, i) => `${i + 1}`),
        valueThemeKeys: ["--grid-template-columns"]
      }
    ]);
    suggest("grid-rows", () => [
      {
        values: Array.from({ length: 12 }, (_, i) => `${i + 1}`),
        valueThemeKeys: ["--grid-template-rows"]
      }
    ]);
    staticUtility("flex-row", [["flex-direction", "row"]]);
    staticUtility("flex-row-reverse", [["flex-direction", "row-reverse"]]);
    staticUtility("flex-col", [["flex-direction", "column"]]);
    staticUtility("flex-col-reverse", [["flex-direction", "column-reverse"]]);
    staticUtility("flex-wrap", [["flex-wrap", "wrap"]]);
    staticUtility("flex-nowrap", [["flex-wrap", "nowrap"]]);
    staticUtility("flex-wrap-reverse", [["flex-wrap", "wrap-reverse"]]);
    staticUtility("place-content-center", [["place-content", "center"]]);
    staticUtility("place-content-start", [["place-content", "start"]]);
    staticUtility("place-content-end", [["place-content", "end"]]);
    staticUtility("place-content-center-safe", [["place-content", "safe center"]]);
    staticUtility("place-content-end-safe", [["place-content", "safe end"]]);
    staticUtility("place-content-between", [["place-content", "space-between"]]);
    staticUtility("place-content-around", [["place-content", "space-around"]]);
    staticUtility("place-content-evenly", [["place-content", "space-evenly"]]);
    staticUtility("place-content-baseline", [["place-content", "baseline"]]);
    staticUtility("place-content-stretch", [["place-content", "stretch"]]);
    staticUtility("place-items-center", [["place-items", "center"]]);
    staticUtility("place-items-start", [["place-items", "start"]]);
    staticUtility("place-items-end", [["place-items", "end"]]);
    staticUtility("place-items-center-safe", [["place-items", "safe center"]]);
    staticUtility("place-items-end-safe", [["place-items", "safe end"]]);
    staticUtility("place-items-baseline", [["place-items", "baseline"]]);
    staticUtility("place-items-stretch", [["place-items", "stretch"]]);
    staticUtility("content-normal", [["align-content", "normal"]]);
    staticUtility("content-center", [["align-content", "center"]]);
    staticUtility("content-start", [["align-content", "flex-start"]]);
    staticUtility("content-end", [["align-content", "flex-end"]]);
    staticUtility("content-center-safe", [["align-content", "safe center"]]);
    staticUtility("content-end-safe", [["align-content", "safe flex-end"]]);
    staticUtility("content-between", [["align-content", "space-between"]]);
    staticUtility("content-around", [["align-content", "space-around"]]);
    staticUtility("content-evenly", [["align-content", "space-evenly"]]);
    staticUtility("content-baseline", [["align-content", "baseline"]]);
    staticUtility("content-stretch", [["align-content", "stretch"]]);
    staticUtility("items-center", [["align-items", "center"]]);
    staticUtility("items-start", [["align-items", "flex-start"]]);
    staticUtility("items-end", [["align-items", "flex-end"]]);
    staticUtility("items-center-safe", [["align-items", "safe center"]]);
    staticUtility("items-end-safe", [["align-items", "safe flex-end"]]);
    staticUtility("items-baseline", [["align-items", "baseline"]]);
    staticUtility("items-baseline-last", [["align-items", "last baseline"]]);
    staticUtility("items-stretch", [["align-items", "stretch"]]);
    staticUtility("justify-normal", [["justify-content", "normal"]]);
    staticUtility("justify-center", [["justify-content", "center"]]);
    staticUtility("justify-start", [["justify-content", "flex-start"]]);
    staticUtility("justify-end", [["justify-content", "flex-end"]]);
    staticUtility("justify-center-safe", [["justify-content", "safe center"]]);
    staticUtility("justify-end-safe", [["justify-content", "safe flex-end"]]);
    staticUtility("justify-between", [["justify-content", "space-between"]]);
    staticUtility("justify-around", [["justify-content", "space-around"]]);
    staticUtility("justify-evenly", [["justify-content", "space-evenly"]]);
    staticUtility("justify-baseline", [["justify-content", "baseline"]]);
    staticUtility("justify-stretch", [["justify-content", "stretch"]]);
    staticUtility("justify-items-normal", [["justify-items", "normal"]]);
    staticUtility("justify-items-center", [["justify-items", "center"]]);
    staticUtility("justify-items-start", [["justify-items", "start"]]);
    staticUtility("justify-items-end", [["justify-items", "end"]]);
    staticUtility("justify-items-center-safe", [["justify-items", "safe center"]]);
    staticUtility("justify-items-end-safe", [["justify-items", "safe end"]]);
    staticUtility("justify-items-stretch", [["justify-items", "stretch"]]);
    spacingUtility("gap", ["--gap", "--spacing"], (value2) => [decl("gap", value2)]);
    spacingUtility("gap-x", ["--gap", "--spacing"], (value2) => [decl("column-gap", value2)]);
    spacingUtility("gap-y", ["--gap", "--spacing"], (value2) => [decl("row-gap", value2)]);
    spacingUtility(
      "space-x",
      ["--space", "--spacing"],
      (value2) => {
        let zero = (() => {
          if (value2 === "--spacing(0)") return true;
          if (value2 === "--spacing(-0)") return true;
          let parsed = dimensions.get(value2);
          if (parsed && parsed[0] === 0 && (parsed[1] === null || isLength(value2))) {
            return true;
          }
          return false;
        })();
        return [
          atRoot([property("--tw-space-x-reverse", "0")]),
          styleRule(":where(& > :not(:last-child))", [
            decl("--tw-sort", "row-gap"),
            decl("--tw-space-x-reverse", "0"),
            decl("margin-inline-start", zero ? "0" : `calc(${value2} * var(--tw-space-x-reverse))`),
            decl(
              "margin-inline-end",
              zero ? "0" : `calc(${value2} * calc(1 - var(--tw-space-x-reverse)))`
            )
          ])
        ];
      },
      { supportsNegative: true }
    );
    spacingUtility(
      "space-y",
      ["--space", "--spacing"],
      (value2) => {
        let zero = (() => {
          if (value2 === "--spacing(0)") return true;
          if (value2 === "--spacing(-0)") return true;
          let parsed = dimensions.get(value2);
          if (parsed && parsed[0] === 0 && (parsed[1] === null || isLength(value2))) {
            return true;
          }
          return false;
        })();
        return [
          atRoot([property("--tw-space-y-reverse", "0")]),
          styleRule(":where(& > :not(:last-child))", [
            decl("--tw-sort", "column-gap"),
            decl("--tw-space-y-reverse", "0"),
            decl("margin-block-start", zero ? "0" : `calc(${value2} * var(--tw-space-y-reverse))`),
            decl(
              "margin-block-end",
              zero ? "0" : `calc(${value2} * calc(1 - var(--tw-space-y-reverse)))`
            )
          ])
        ];
      },
      { supportsNegative: true }
    );
    staticUtility("space-x-reverse", [
      () => atRoot([property("--tw-space-x-reverse", "0")]),
      () => styleRule(":where(& > :not(:last-child))", [
        decl("--tw-sort", "row-gap"),
        decl("--tw-space-x-reverse", "1")
      ])
    ]);
    staticUtility("space-y-reverse", [
      () => atRoot([property("--tw-space-y-reverse", "0")]),
      () => styleRule(":where(& > :not(:last-child))", [
        decl("--tw-sort", "column-gap"),
        decl("--tw-space-y-reverse", "1")
      ])
    ]);
    staticUtility("accent-auto", [["accent-color", "auto"]]);
    colorUtility("accent", {
      themeKeys: ["--accent-color", "--color"],
      handle: (value2) => [decl("accent-color", value2)]
    });
    colorUtility("caret", {
      themeKeys: ["--caret-color", "--color"],
      handle: (value2) => [decl("caret-color", value2)]
    });
    colorUtility("divide", {
      themeKeys: ["--divide-color", "--border-color", "--color"],
      handle: (value2) => [
        styleRule(":where(& > :not(:last-child))", [
          decl("--tw-sort", "divide-color"),
          decl("border-color", value2)
        ])
      ]
    });
    staticUtility("place-self-auto", [["place-self", "auto"]]);
    staticUtility("place-self-start", [["place-self", "start"]]);
    staticUtility("place-self-end", [["place-self", "end"]]);
    staticUtility("place-self-center", [["place-self", "center"]]);
    staticUtility("place-self-end-safe", [["place-self", "safe end"]]);
    staticUtility("place-self-center-safe", [["place-self", "safe center"]]);
    staticUtility("place-self-stretch", [["place-self", "stretch"]]);
    staticUtility("self-auto", [["align-self", "auto"]]);
    staticUtility("self-start", [["align-self", "flex-start"]]);
    staticUtility("self-end", [["align-self", "flex-end"]]);
    staticUtility("self-center", [["align-self", "center"]]);
    staticUtility("self-end-safe", [["align-self", "safe flex-end"]]);
    staticUtility("self-center-safe", [["align-self", "safe center"]]);
    staticUtility("self-stretch", [["align-self", "stretch"]]);
    staticUtility("self-baseline", [["align-self", "baseline"]]);
    staticUtility("self-baseline-last", [["align-self", "last baseline"]]);
    staticUtility("justify-self-auto", [["justify-self", "auto"]]);
    staticUtility("justify-self-start", [["justify-self", "flex-start"]]);
    staticUtility("justify-self-end", [["justify-self", "flex-end"]]);
    staticUtility("justify-self-center", [["justify-self", "center"]]);
    staticUtility("justify-self-end-safe", [["justify-self", "safe flex-end"]]);
    staticUtility("justify-self-center-safe", [["justify-self", "safe center"]]);
    staticUtility("justify-self-stretch", [["justify-self", "stretch"]]);
    for (let value2 of ["auto", "hidden", "clip", "visible", "scroll"]) {
      staticUtility(`overflow-${value2}`, [["overflow", value2]]);
      staticUtility(`overflow-x-${value2}`, [["overflow-x", value2]]);
      staticUtility(`overflow-y-${value2}`, [["overflow-y", value2]]);
    }
    for (let value2 of ["auto", "contain", "none"]) {
      staticUtility(`overscroll-${value2}`, [["overscroll-behavior", value2]]);
      staticUtility(`overscroll-x-${value2}`, [["overscroll-behavior-x", value2]]);
      staticUtility(`overscroll-y-${value2}`, [["overscroll-behavior-y", value2]]);
    }
    staticUtility("scroll-auto", [["scroll-behavior", "auto"]]);
    staticUtility("scroll-smooth", [["scroll-behavior", "smooth"]]);
    staticUtility("scrollbar-auto", [["scrollbar-width", "auto"]]);
    staticUtility("scrollbar-thin", [["scrollbar-width", "thin"]]);
    staticUtility("scrollbar-none", [["scrollbar-width", "none"]]);
    {
      let scrollbarColorProperties = () => {
        return atRoot([
          property("--tw-scrollbar-thumb", "#0000", "<color>"),
          property("--tw-scrollbar-track", "#0000", "<color>")
        ]);
      };
      colorUtility("scrollbar-thumb", {
        themeKeys: ["--color"],
        handle: (value2) => [
          scrollbarColorProperties(),
          decl("--tw-scrollbar-thumb", value2),
          decl("scrollbar-color", "var(--tw-scrollbar-thumb) var(--tw-scrollbar-track)")
        ]
      });
      colorUtility("scrollbar-track", {
        themeKeys: ["--color"],
        handle: (value2) => [
          scrollbarColorProperties(),
          decl("--tw-scrollbar-track", value2),
          decl("scrollbar-color", "var(--tw-scrollbar-thumb) var(--tw-scrollbar-track)")
        ]
      });
    }
    staticUtility("scrollbar-gutter-auto", [["scrollbar-gutter", "auto"]]);
    staticUtility("scrollbar-gutter-stable", [["scrollbar-gutter", "stable"]]);
    staticUtility("scrollbar-gutter-both", [["scrollbar-gutter", "stable both-edges"]]);
    staticUtility("truncate", [
      ["overflow", "hidden"],
      ["text-overflow", "ellipsis"],
      ["white-space", "nowrap"]
    ]);
    staticUtility("text-ellipsis", [["text-overflow", "ellipsis"]]);
    staticUtility("text-clip", [["text-overflow", "clip"]]);
    staticUtility("hyphens-none", [
      ["-webkit-hyphens", "none"],
      ["hyphens", "none"]
    ]);
    staticUtility("hyphens-manual", [
      ["-webkit-hyphens", "manual"],
      ["hyphens", "manual"]
    ]);
    staticUtility("hyphens-auto", [
      ["-webkit-hyphens", "auto"],
      ["hyphens", "auto"]
    ]);
    staticUtility("whitespace-normal", [["white-space", "normal"]]);
    staticUtility("whitespace-nowrap", [["white-space", "nowrap"]]);
    staticUtility("whitespace-pre", [["white-space", "pre"]]);
    staticUtility("whitespace-pre-line", [["white-space", "pre-line"]]);
    staticUtility("whitespace-pre-wrap", [["white-space", "pre-wrap"]]);
    staticUtility("whitespace-break-spaces", [["white-space", "break-spaces"]]);
    functionalUtility("tab", {
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return value2;
      },
      handle: (value2) => [decl("tab-size", value2)]
    });
    suggest("tab", () => [{ values: ["2", "4", "8"] }]);
    staticUtility("text-wrap", [["text-wrap", "wrap"]]);
    staticUtility("text-nowrap", [["text-wrap", "nowrap"]]);
    staticUtility("text-balance", [["text-wrap", "balance"]]);
    staticUtility("text-pretty", [["text-wrap", "pretty"]]);
    staticUtility("break-normal", [
      ["overflow-wrap", "normal"],
      ["word-break", "normal"]
    ]);
    staticUtility("break-all", [["word-break", "break-all"]]);
    staticUtility("break-keep", [["word-break", "keep-all"]]);
    staticUtility("wrap-anywhere", [["overflow-wrap", "anywhere"]]);
    staticUtility("wrap-break-word", [["overflow-wrap", "break-word"]]);
    staticUtility("wrap-normal", [["overflow-wrap", "normal"]]);
    {
      for (let [root, properties] of [
        ["rounded", ["border-radius"]],
        ["rounded-s", ["border-start-start-radius", "border-end-start-radius"]],
        ["rounded-e", ["border-start-end-radius", "border-end-end-radius"]],
        ["rounded-t", ["border-top-left-radius", "border-top-right-radius"]],
        ["rounded-r", ["border-top-right-radius", "border-bottom-right-radius"]],
        ["rounded-b", ["border-bottom-right-radius", "border-bottom-left-radius"]],
        ["rounded-l", ["border-top-left-radius", "border-bottom-left-radius"]],
        ["rounded-ss", ["border-start-start-radius"]],
        ["rounded-se", ["border-start-end-radius"]],
        ["rounded-ee", ["border-end-end-radius"]],
        ["rounded-es", ["border-end-start-radius"]],
        ["rounded-tl", ["border-top-left-radius"]],
        ["rounded-tr", ["border-top-right-radius"]],
        ["rounded-br", ["border-bottom-right-radius"]],
        ["rounded-bl", ["border-bottom-left-radius"]]
      ]) {
        functionalUtility(root, {
          themeKeys: ["--radius"],
          handle: (value2) => properties.map((property2) => decl(property2, value2)),
          staticValues: {
            none: properties.map((property2) => decl(property2, "0")),
            full: properties.map((property2) => decl(property2, "calc(infinity * 1px)"))
          }
        });
      }
    }
    staticUtility("border-solid", [
      ["--tw-border-style", "solid"],
      ["border-style", "solid"]
    ]);
    staticUtility("border-dashed", [
      ["--tw-border-style", "dashed"],
      ["border-style", "dashed"]
    ]);
    staticUtility("border-dotted", [
      ["--tw-border-style", "dotted"],
      ["border-style", "dotted"]
    ]);
    staticUtility("border-double", [
      ["--tw-border-style", "double"],
      ["border-style", "double"]
    ]);
    staticUtility("border-hidden", [
      ["--tw-border-style", "hidden"],
      ["border-style", "hidden"]
    ]);
    staticUtility("border-none", [
      ["--tw-border-style", "none"],
      ["border-style", "none"]
    ]);
    {
      let borderSideUtility2 = function(classRoot, desc) {
        utilities2.functional(classRoot, (candidate) => {
          if (!candidate.value) {
            if (candidate.modifier) return;
            let value2 = theme2.get(["--default-border-width"]) ?? "1px";
            let decls = desc.width(value2);
            if (!decls) return;
            return [borderProperties(), ...decls];
          }
          if (candidate.value.kind === "arbitrary") {
            let value2 = candidate.value.value;
            let type = candidate.value.dataType ?? inferDataType(value2, ["color", "line-width", "length"]);
            switch (type) {
              case "line-width":
              case "length": {
                if (candidate.modifier) return;
                let decls = desc.width(value2);
                if (!decls) return;
                return [borderProperties(), ...decls];
              }
              default: {
                value2 = asColor(value2, candidate.modifier, theme2);
                if (value2 === null) return;
                return desc.color(value2);
              }
            }
          }
          {
            let value2 = resolveThemeColor(candidate, theme2, ["--border-color", "--color"]);
            if (value2) {
              return desc.color(value2);
            }
          }
          {
            if (candidate.modifier) return;
            let value2 = theme2.resolve(candidate.value.value, ["--border-width"]);
            if (value2) {
              let decls = desc.width(value2);
              if (!decls) return;
              return [borderProperties(), ...decls];
            }
            if (isPositiveInteger(candidate.value.value)) {
              let decls = desc.width(`${candidate.value.value}px`);
              if (!decls) return;
              return [borderProperties(), ...decls];
            }
          }
        });
        suggest(classRoot, () => [
          {
            values: ["current", "inherit", "transparent"],
            valueThemeKeys: ["--border-color", "--color"],
            modifierThemeKeys: ["--opacity"],
            modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`),
            hasDefaultValue: true
          },
          {
            values: ["0", "2", "4", "8"],
            valueThemeKeys: ["--border-width"]
          }
        ]);
      };
      var borderSideUtility = borderSideUtility2;
      let borderProperties = () => {
        return atRoot([property("--tw-border-style", "solid")]);
      };
      borderSideUtility2("border", {
        width: (value2) => [
          decl("border-style", "var(--tw-border-style)"),
          decl("border-width", value2)
        ],
        color: (value2) => [decl("border-color", value2)]
      });
      borderSideUtility2("border-x", {
        width: (value2) => [
          decl("border-inline-style", "var(--tw-border-style)"),
          decl("border-inline-width", value2)
        ],
        color: (value2) => [decl("border-inline-color", value2)]
      });
      borderSideUtility2("border-y", {
        width: (value2) => [
          decl("border-block-style", "var(--tw-border-style)"),
          decl("border-block-width", value2)
        ],
        color: (value2) => [decl("border-block-color", value2)]
      });
      borderSideUtility2("border-s", {
        width: (value2) => [
          decl("border-inline-start-style", "var(--tw-border-style)"),
          decl("border-inline-start-width", value2)
        ],
        color: (value2) => [decl("border-inline-start-color", value2)]
      });
      borderSideUtility2("border-e", {
        width: (value2) => [
          decl("border-inline-end-style", "var(--tw-border-style)"),
          decl("border-inline-end-width", value2)
        ],
        color: (value2) => [decl("border-inline-end-color", value2)]
      });
      borderSideUtility2("border-bs", {
        width: (value2) => [
          decl("border-block-start-style", "var(--tw-border-style)"),
          decl("border-block-start-width", value2)
        ],
        color: (value2) => [decl("border-block-start-color", value2)]
      });
      borderSideUtility2("border-be", {
        width: (value2) => [
          decl("border-block-end-style", "var(--tw-border-style)"),
          decl("border-block-end-width", value2)
        ],
        color: (value2) => [decl("border-block-end-color", value2)]
      });
      borderSideUtility2("border-t", {
        width: (value2) => [
          decl("border-top-style", "var(--tw-border-style)"),
          decl("border-top-width", value2)
        ],
        color: (value2) => [decl("border-top-color", value2)]
      });
      borderSideUtility2("border-r", {
        width: (value2) => [
          decl("border-right-style", "var(--tw-border-style)"),
          decl("border-right-width", value2)
        ],
        color: (value2) => [decl("border-right-color", value2)]
      });
      borderSideUtility2("border-b", {
        width: (value2) => [
          decl("border-bottom-style", "var(--tw-border-style)"),
          decl("border-bottom-width", value2)
        ],
        color: (value2) => [decl("border-bottom-color", value2)]
      });
      borderSideUtility2("border-l", {
        width: (value2) => [
          decl("border-left-style", "var(--tw-border-style)"),
          decl("border-left-width", value2)
        ],
        color: (value2) => [decl("border-left-color", value2)]
      });
      functionalUtility("divide-x", {
        defaultValue: theme2.get(["--default-border-width"]) ?? "1px",
        themeKeys: ["--divide-width", "--border-width"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}px`;
        },
        handle: (value2) => [
          atRoot([property("--tw-divide-x-reverse", "0")]),
          styleRule(":where(& > :not(:last-child))", [
            decl("--tw-sort", "divide-x-width"),
            borderProperties(),
            decl("--tw-divide-x-reverse", "0"),
            decl("border-inline-style", "var(--tw-border-style)"),
            decl("border-inline-start-width", `calc(${value2} * var(--tw-divide-x-reverse))`),
            decl("border-inline-end-width", `calc(${value2} * calc(1 - var(--tw-divide-x-reverse)))`)
          ])
        ]
      });
      functionalUtility("divide-y", {
        defaultValue: theme2.get(["--default-border-width"]) ?? "1px",
        themeKeys: ["--divide-width", "--border-width"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}px`;
        },
        handle: (value2) => [
          atRoot([property("--tw-divide-y-reverse", "0")]),
          styleRule(":where(& > :not(:last-child))", [
            decl("--tw-sort", "divide-y-width"),
            borderProperties(),
            decl("--tw-divide-y-reverse", "0"),
            decl("border-bottom-style", "var(--tw-border-style)"),
            decl("border-top-style", "var(--tw-border-style)"),
            decl("border-top-width", `calc(${value2} * var(--tw-divide-y-reverse))`),
            decl("border-bottom-width", `calc(${value2} * calc(1 - var(--tw-divide-y-reverse)))`)
          ])
        ]
      });
      suggest("divide-x", () => [
        {
          values: ["0", "2", "4", "8"],
          valueThemeKeys: ["--divide-width", "--border-width"],
          hasDefaultValue: true
        }
      ]);
      suggest("divide-y", () => [
        {
          values: ["0", "2", "4", "8"],
          valueThemeKeys: ["--divide-width", "--border-width"],
          hasDefaultValue: true
        }
      ]);
      staticUtility("divide-x-reverse", [
        () => atRoot([property("--tw-divide-x-reverse", "0")]),
        () => styleRule(":where(& > :not(:last-child))", [decl("--tw-divide-x-reverse", "1")])
      ]);
      staticUtility("divide-y-reverse", [
        () => atRoot([property("--tw-divide-y-reverse", "0")]),
        () => styleRule(":where(& > :not(:last-child))", [decl("--tw-divide-y-reverse", "1")])
      ]);
      for (let value2 of ["solid", "dashed", "dotted", "double", "none"]) {
        staticUtility(`divide-${value2}`, [
          () => styleRule(":where(& > :not(:last-child))", [
            decl("--tw-sort", "divide-style"),
            decl("--tw-border-style", value2),
            decl("border-style", value2)
          ])
        ]);
      }
    }
    staticUtility("bg-auto", [["background-size", "auto"]]);
    staticUtility("bg-cover", [["background-size", "cover"]]);
    staticUtility("bg-contain", [["background-size", "contain"]]);
    functionalUtility("bg-size", {
      handle(value2) {
        if (!value2) return;
        return [decl("background-size", value2)];
      }
    });
    staticUtility("bg-fixed", [["background-attachment", "fixed"]]);
    staticUtility("bg-local", [["background-attachment", "local"]]);
    staticUtility("bg-scroll", [["background-attachment", "scroll"]]);
    staticUtility("bg-top", [["background-position", "top"]]);
    staticUtility("bg-top-left", [["background-position", "left top"]]);
    staticUtility("bg-top-right", [["background-position", "right top"]]);
    staticUtility("bg-bottom", [["background-position", "bottom"]]);
    staticUtility("bg-bottom-left", [["background-position", "left bottom"]]);
    staticUtility("bg-bottom-right", [["background-position", "right bottom"]]);
    staticUtility("bg-left", [["background-position", "left"]]);
    staticUtility("bg-right", [["background-position", "right"]]);
    staticUtility("bg-center", [["background-position", "center"]]);
    functionalUtility("bg-position", {
      handle(value2) {
        if (!value2) return;
        return [decl("background-position", value2)];
      }
    });
    staticUtility("bg-repeat", [["background-repeat", "repeat"]]);
    staticUtility("bg-no-repeat", [["background-repeat", "no-repeat"]]);
    staticUtility("bg-repeat-x", [["background-repeat", "repeat-x"]]);
    staticUtility("bg-repeat-y", [["background-repeat", "repeat-y"]]);
    staticUtility("bg-repeat-round", [["background-repeat", "round"]]);
    staticUtility("bg-repeat-space", [["background-repeat", "space"]]);
    staticUtility("bg-none", [["background-image", "none"]]);
    {
      let resolveInterpolationModifier2 = function(modifier) {
        let interpolationMethod = "in oklab";
        if (modifier?.kind === "named") {
          switch (modifier.value) {
            case "longer":
            case "shorter":
            case "increasing":
            case "decreasing":
              interpolationMethod = `in oklch ${modifier.value} hue`;
              break;
            default:
              interpolationMethod = `in ${modifier.value}`;
          }
        } else if (modifier?.kind === "arbitrary") {
          interpolationMethod = modifier.value;
        }
        return interpolationMethod;
      }, handleBgLinear2 = function({ negative }) {
        return (candidate) => {
          if (!candidate.value) return;
          if (candidate.value.kind === "arbitrary") {
            if (candidate.modifier) return;
            let value3 = candidate.value.value;
            let type = candidate.value.dataType ?? inferDataType(value3, ["angle"]);
            switch (type) {
              case "angle": {
                value3 = negative ? `calc(${value3} * -1)` : `${value3}`;
                return [
                  decl("--tw-gradient-position", value3),
                  decl("background-image", `linear-gradient(var(--tw-gradient-stops,${value3}))`)
                ];
              }
              default: {
                if (negative) return;
                return [
                  decl("--tw-gradient-position", value3),
                  decl("background-image", `linear-gradient(var(--tw-gradient-stops,${value3}))`)
                ];
              }
            }
          }
          let value2 = candidate.value.value;
          if (!negative && linearGradientDirections.has(value2)) {
            value2 = linearGradientDirections.get(value2);
          } else if (isPositiveInteger(value2)) {
            value2 = negative ? `calc(${value2}deg * -1)` : `${value2}deg`;
          } else {
            return;
          }
          let interpolationMethod = resolveInterpolationModifier2(candidate.modifier);
          return [
            decl("--tw-gradient-position", `${value2}`),
            rule("@supports (background-image: linear-gradient(in lab, red, red))", [
              decl("--tw-gradient-position", `${value2} ${interpolationMethod}`)
            ]),
            decl("background-image", `linear-gradient(var(--tw-gradient-stops))`)
          ];
        };
      }, handleBgConic2 = function({ negative }) {
        return (candidate) => {
          if (candidate.value?.kind === "arbitrary") {
            if (candidate.modifier) return;
            let value3 = candidate.value.value;
            return [
              decl("--tw-gradient-position", value3),
              decl("background-image", `conic-gradient(var(--tw-gradient-stops,${value3}))`)
            ];
          }
          let interpolationMethod = resolveInterpolationModifier2(candidate.modifier);
          if (!candidate.value) {
            return [
              decl("--tw-gradient-position", interpolationMethod),
              decl("background-image", `conic-gradient(var(--tw-gradient-stops))`)
            ];
          }
          let value2 = candidate.value.value;
          if (!isPositiveInteger(value2)) return;
          value2 = negative ? `calc(${value2}deg * -1)` : `${value2}deg`;
          return [
            decl("--tw-gradient-position", `from ${value2} ${interpolationMethod}`),
            decl("background-image", `conic-gradient(var(--tw-gradient-stops))`)
          ];
        };
      };
      var resolveInterpolationModifier = resolveInterpolationModifier2, handleBgLinear = handleBgLinear2, handleBgConic = handleBgConic2;
      let suggestedModifiers = [
        "oklab",
        "oklch",
        "srgb",
        "hsl",
        "longer",
        "shorter",
        "increasing",
        "decreasing"
      ];
      let linearGradientDirections = /* @__PURE__ */ new Map([
        ["to-t", "to top"],
        ["to-tr", "to top right"],
        ["to-r", "to right"],
        ["to-br", "to bottom right"],
        ["to-b", "to bottom"],
        ["to-bl", "to bottom left"],
        ["to-l", "to left"],
        ["to-tl", "to top left"]
      ]);
      utilities2.functional("-bg-linear", handleBgLinear2({ negative: true }));
      utilities2.functional("bg-linear", handleBgLinear2({ negative: false }));
      suggest("bg-linear", () => [
        {
          values: [...linearGradientDirections.keys()],
          modifiers: suggestedModifiers
        },
        {
          values: ["0", "30", "60", "90", "120", "150", "180", "210", "240", "270", "300", "330"],
          supportsNegative: true,
          modifiers: suggestedModifiers
        }
      ]);
      utilities2.functional("-bg-conic", handleBgConic2({ negative: true }));
      utilities2.functional("bg-conic", handleBgConic2({ negative: false }));
      suggest("bg-conic", () => [
        {
          hasDefaultValue: true,
          modifiers: suggestedModifiers
        },
        {
          values: ["0", "30", "60", "90", "120", "150", "180", "210", "240", "270", "300", "330"],
          supportsNegative: true,
          modifiers: suggestedModifiers
        }
      ]);
      utilities2.functional("bg-radial", (candidate) => {
        if (!candidate.value) {
          let interpolationMethod = resolveInterpolationModifier2(candidate.modifier);
          return [
            decl("--tw-gradient-position", interpolationMethod),
            decl("background-image", `radial-gradient(var(--tw-gradient-stops))`)
          ];
        }
        if (candidate.value.kind === "arbitrary") {
          if (candidate.modifier) return;
          let value2 = candidate.value.value;
          return [
            decl("--tw-gradient-position", value2),
            decl("background-image", `radial-gradient(var(--tw-gradient-stops,${value2}))`)
          ];
        }
      });
      suggest("bg-radial", () => [
        {
          hasDefaultValue: true,
          modifiers: suggestedModifiers
        }
      ]);
    }
    utilities2.functional("bg", (candidate) => {
      if (!candidate.value) return;
      if (candidate.value.kind === "arbitrary") {
        let value2 = candidate.value.value;
        let type = candidate.value.dataType ?? inferDataType(value2, [
          "image",
          "color",
          "percentage",
          "position",
          "bg-size",
          "length",
          "url"
        ]);
        switch (type) {
          case "percentage":
          case "position": {
            if (candidate.modifier) return;
            return [decl("background-position", value2)];
          }
          case "bg-size":
          case "length":
          case "size": {
            if (candidate.modifier) return;
            return [decl("background-size", value2)];
          }
          case "image":
          case "url": {
            if (candidate.modifier) return;
            return [decl("background-image", value2)];
          }
          default: {
            value2 = asColor(value2, candidate.modifier, theme2);
            if (value2 === null) return;
            return [decl("background-color", value2)];
          }
        }
      }
      {
        let value2 = resolveThemeColor(candidate, theme2, ["--background-color", "--color"]);
        if (value2) {
          return [decl("background-color", value2)];
        }
      }
      {
        if (candidate.modifier) return;
        let value2 = theme2.resolve(candidate.value.value, ["--background-image"]);
        if (value2) {
          return [decl("background-image", value2)];
        }
      }
    });
    suggest("bg", () => [
      {
        values: ["current", "inherit", "transparent"],
        valueThemeKeys: ["--background-color", "--color"],
        modifierThemeKeys: ["--opacity"],
        modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
      },
      {
        values: [],
        valueThemeKeys: ["--background-image"]
      }
    ]);
    let gradientStopProperties = () => {
      return atRoot([
        property("--tw-gradient-position"),
        property("--tw-gradient-from", "#0000", "<color>"),
        property("--tw-gradient-via", "#0000", "<color>"),
        property("--tw-gradient-to", "#0000", "<color>"),
        property("--tw-gradient-stops"),
        property("--tw-gradient-via-stops"),
        property("--tw-gradient-from-position", "0%", "<length-percentage>"),
        property("--tw-gradient-via-position", "50%", "<length-percentage>"),
        property("--tw-gradient-to-position", "100%", "<length-percentage>")
      ]);
    };
    function gradientStopUtility(classRoot, desc) {
      utilities2.functional(classRoot, (candidate) => {
        if (!candidate.value) return;
        if (candidate.value.kind === "arbitrary") {
          let value2 = candidate.value.value;
          let type = candidate.value.dataType ?? inferDataType(value2, ["color", "length", "percentage"]);
          switch (type) {
            case "length":
            case "percentage": {
              if (candidate.modifier) return;
              return desc.position(value2);
            }
            default: {
              value2 = asColor(value2, candidate.modifier, theme2);
              if (value2 === null) return;
              return desc.color(value2);
            }
          }
        }
        {
          let value2 = resolveThemeColor(candidate, theme2, ["--background-color", "--color"]);
          if (value2) {
            return desc.color(value2);
          }
        }
        {
          if (candidate.modifier) return;
          let value2 = theme2.resolve(candidate.value.value, ["--gradient-color-stop-positions"]);
          if (value2) {
            return desc.position(value2);
          } else if (candidate.value.value[candidate.value.value.length - 1] === "%" && isPositiveInteger(candidate.value.value.slice(0, -1))) {
            return desc.position(candidate.value.value);
          }
        }
      });
      suggest(classRoot, () => [
        {
          values: ["current", "inherit", "transparent"],
          valueThemeKeys: ["--background-color", "--color"],
          modifierThemeKeys: ["--opacity"],
          modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
        },
        {
          values: Array.from({ length: 21 }, (_, index) => `${index * 5}%`),
          valueThemeKeys: ["--gradient-color-stop-positions"]
        }
      ]);
    }
    gradientStopUtility("from", {
      color: (value2) => [
        gradientStopProperties(),
        decl("--tw-sort", "--tw-gradient-from"),
        decl("--tw-gradient-from", value2),
        decl(
          "--tw-gradient-stops",
          "var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))"
        )
      ],
      position: (value2) => [gradientStopProperties(), decl("--tw-gradient-from-position", value2)]
    });
    staticUtility("via-none", [["--tw-gradient-via-stops", "initial"]]);
    gradientStopUtility("via", {
      color: (value2) => [
        gradientStopProperties(),
        decl("--tw-sort", "--tw-gradient-via"),
        decl("--tw-gradient-via", value2),
        decl(
          "--tw-gradient-via-stops",
          "var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-via) var(--tw-gradient-via-position), var(--tw-gradient-to) var(--tw-gradient-to-position)"
        ),
        decl("--tw-gradient-stops", "var(--tw-gradient-via-stops)")
      ],
      position: (value2) => [gradientStopProperties(), decl("--tw-gradient-via-position", value2)]
    });
    gradientStopUtility("to", {
      color: (value2) => [
        gradientStopProperties(),
        decl("--tw-sort", "--tw-gradient-to"),
        decl("--tw-gradient-to", value2),
        decl(
          "--tw-gradient-stops",
          "var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))"
        )
      ],
      position: (value2) => [gradientStopProperties(), decl("--tw-gradient-to-position", value2)]
    });
    staticUtility("mask-none", [["mask-image", "none"]]);
    utilities2.functional("mask", (candidate) => {
      if (!candidate.value) return;
      if (candidate.modifier) return;
      if (candidate.value.kind !== "arbitrary") return;
      let value2 = candidate.value.value;
      let type = candidate.value.dataType ?? inferDataType(value2, ["image", "percentage", "position", "bg-size", "length", "url"]);
      switch (type) {
        case "percentage":
        case "position": {
          if (candidate.modifier) return;
          return [decl("mask-position", value2)];
        }
        case "bg-size":
        case "length":
        case "size": {
          return [decl("mask-size", value2)];
        }
        case "image":
        case "url":
        default: {
          return [decl("mask-image", value2)];
        }
      }
    });
    staticUtility("mask-add", [["mask-composite", "add"]]);
    staticUtility("mask-subtract", [["mask-composite", "subtract"]]);
    staticUtility("mask-intersect", [["mask-composite", "intersect"]]);
    staticUtility("mask-exclude", [["mask-composite", "exclude"]]);
    staticUtility("mask-alpha", [["mask-mode", "alpha"]]);
    staticUtility("mask-luminance", [["mask-mode", "luminance"]]);
    staticUtility("mask-match", [["mask-mode", "match-source"]]);
    staticUtility("mask-type-alpha", [["mask-type", "alpha"]]);
    staticUtility("mask-type-luminance", [["mask-type", "luminance"]]);
    staticUtility("mask-auto", [["mask-size", "auto"]]);
    staticUtility("mask-cover", [["mask-size", "cover"]]);
    staticUtility("mask-contain", [["mask-size", "contain"]]);
    functionalUtility("mask-size", {
      handle(value2) {
        if (!value2) return;
        return [decl("mask-size", value2)];
      }
    });
    staticUtility("mask-top", [["mask-position", "top"]]);
    staticUtility("mask-top-left", [["mask-position", "left top"]]);
    staticUtility("mask-top-right", [["mask-position", "right top"]]);
    staticUtility("mask-bottom", [["mask-position", "bottom"]]);
    staticUtility("mask-bottom-left", [["mask-position", "left bottom"]]);
    staticUtility("mask-bottom-right", [["mask-position", "right bottom"]]);
    staticUtility("mask-left", [["mask-position", "left"]]);
    staticUtility("mask-right", [["mask-position", "right"]]);
    staticUtility("mask-center", [["mask-position", "center"]]);
    functionalUtility("mask-position", {
      handle(value2) {
        if (!value2) return;
        return [decl("mask-position", value2)];
      }
    });
    staticUtility("mask-repeat", [["mask-repeat", "repeat"]]);
    staticUtility("mask-no-repeat", [["mask-repeat", "no-repeat"]]);
    staticUtility("mask-repeat-x", [["mask-repeat", "repeat-x"]]);
    staticUtility("mask-repeat-y", [["mask-repeat", "repeat-y"]]);
    staticUtility("mask-repeat-round", [["mask-repeat", "round"]]);
    staticUtility("mask-repeat-space", [["mask-repeat", "space"]]);
    staticUtility("mask-clip-border", [["mask-clip", "border-box"]]);
    staticUtility("mask-clip-padding", [["mask-clip", "padding-box"]]);
    staticUtility("mask-clip-content", [["mask-clip", "content-box"]]);
    staticUtility("mask-clip-fill", [["mask-clip", "fill-box"]]);
    staticUtility("mask-clip-stroke", [["mask-clip", "stroke-box"]]);
    staticUtility("mask-clip-view", [["mask-clip", "view-box"]]);
    staticUtility("mask-no-clip", [["mask-clip", "no-clip"]]);
    staticUtility("mask-origin-border", [["mask-origin", "border-box"]]);
    staticUtility("mask-origin-padding", [["mask-origin", "padding-box"]]);
    staticUtility("mask-origin-content", [["mask-origin", "content-box"]]);
    staticUtility("mask-origin-fill", [["mask-origin", "fill-box"]]);
    staticUtility("mask-origin-stroke", [["mask-origin", "stroke-box"]]);
    staticUtility("mask-origin-view", [["mask-origin", "view-box"]]);
    let maskPropertiesGradient = () => atRoot([
      property("--tw-mask-linear", "linear-gradient(#fff, #fff)"),
      property("--tw-mask-radial", "linear-gradient(#fff, #fff)"),
      property("--tw-mask-conic", "linear-gradient(#fff, #fff)")
    ]);
    function maskStopUtility(classRoot, desc) {
      utilities2.functional(classRoot, (candidate) => {
        if (!candidate.value) return;
        if (candidate.value.kind === "arbitrary") {
          let value2 = candidate.value.value;
          let type = candidate.value.dataType ?? inferDataType(value2, ["length", "percentage", "color"]);
          switch (type) {
            case "color": {
              value2 = asColor(value2, candidate.modifier, theme2);
              if (value2 === null) return;
              return desc.color(value2);
            }
            case "percentage": {
              if (candidate.modifier) return;
              if (!isPositiveInteger(value2.slice(0, -1))) return;
              return desc.position(value2);
            }
            default: {
              if (candidate.modifier) return;
              return desc.position(value2);
            }
          }
        }
        {
          let value2 = resolveThemeColor(candidate, theme2, ["--background-color", "--color"]);
          if (value2) {
            return desc.color(value2);
          }
        }
        {
          if (candidate.modifier) return;
          let type = inferDataType(candidate.value.value, ["number", "percentage"]);
          if (!type) return;
          switch (type) {
            case "number": {
              let multiplier = theme2.resolve(null, ["--spacing"]);
              if (!multiplier) return;
              if (!isValidSpacingMultiplier(candidate.value.value)) return;
              return desc.position(`--spacing(${candidate.value.value})`);
            }
            case "percentage": {
              if (!isPositiveInteger(candidate.value.value.slice(0, -1))) return;
              return desc.position(candidate.value.value);
            }
            default: {
              return;
            }
          }
        }
      });
      suggest(classRoot, () => [
        {
          values: ["current", "inherit", "transparent"],
          valueThemeKeys: ["--background-color", "--color"],
          modifierThemeKeys: ["--opacity"],
          modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
        },
        {
          values: Array.from({ length: 21 }, (_, index) => `${index * 5}%`),
          valueThemeKeys: ["--gradient-color-stop-positions"]
        }
      ]);
      suggest(classRoot, () => [
        // Percentages
        {
          values: Array.from({ length: 21 }, (_, index) => `${index * 5}%`)
        },
        // Spacing Scale
        {
          values: theme2.get(["--spacing"]) ? DEFAULT_SPACING_SUGGESTIONS : []
        },
        // Colors
        {
          values: ["current", "inherit", "transparent"],
          valueThemeKeys: ["--background-color", "--color"],
          modifierThemeKeys: ["--opacity"],
          modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
        }
      ]);
    }
    let maskPropertiesEdge = () => atRoot([
      property("--tw-mask-left", "linear-gradient(#fff, #fff)"),
      property("--tw-mask-right", "linear-gradient(#fff, #fff)"),
      property("--tw-mask-bottom", "linear-gradient(#fff, #fff)"),
      property("--tw-mask-top", "linear-gradient(#fff, #fff)")
    ]);
    function maskEdgeUtility(name, stop, edges) {
      maskStopUtility(name, {
        color(value2) {
          let nodes = [
            // Common @property declarations
            maskPropertiesGradient(),
            maskPropertiesEdge(),
            // Common properties to all edge utilities
            decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
            decl("mask-composite", "intersect"),
            decl(
              "--tw-mask-linear",
              "var(--tw-mask-left), var(--tw-mask-right), var(--tw-mask-bottom), var(--tw-mask-top)"
            )
          ];
          for (let edge of ["top", "right", "bottom", "left"]) {
            if (!edges[edge]) continue;
            nodes.push(
              decl(
                `--tw-mask-${edge}`,
                `linear-gradient(to ${edge}, var(--tw-mask-${edge}-from-color) var(--tw-mask-${edge}-from-position), var(--tw-mask-${edge}-to-color) var(--tw-mask-${edge}-to-position))`
              )
            );
            nodes.push(
              atRoot([
                property(`--tw-mask-${edge}-from-position`, "0%"),
                property(`--tw-mask-${edge}-to-position`, "100%"),
                property(`--tw-mask-${edge}-from-color`, "black"),
                property(`--tw-mask-${edge}-to-color`, "transparent")
              ])
            );
            nodes.push(decl(`--tw-mask-${edge}-${stop}-color`, value2));
          }
          return nodes;
        },
        position(value2) {
          let nodes = [
            // Common @property declarations
            maskPropertiesGradient(),
            maskPropertiesEdge(),
            // Common properties to all edge utilities
            decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
            decl("mask-composite", "intersect"),
            decl(
              "--tw-mask-linear",
              "var(--tw-mask-left), var(--tw-mask-right), var(--tw-mask-bottom), var(--tw-mask-top)"
            )
          ];
          for (let edge of ["top", "right", "bottom", "left"]) {
            if (!edges[edge]) continue;
            nodes.push(
              decl(
                `--tw-mask-${edge}`,
                `linear-gradient(to ${edge}, var(--tw-mask-${edge}-from-color) var(--tw-mask-${edge}-from-position), var(--tw-mask-${edge}-to-color) var(--tw-mask-${edge}-to-position))`
              )
            );
            nodes.push(
              atRoot([
                property(`--tw-mask-${edge}-from-position`, "0%"),
                property(`--tw-mask-${edge}-to-position`, "100%"),
                property(`--tw-mask-${edge}-from-color`, "black"),
                property(`--tw-mask-${edge}-to-color`, "transparent")
              ])
            );
            nodes.push(decl(`--tw-mask-${edge}-${stop}-position`, value2));
          }
          return nodes;
        }
      });
    }
    maskEdgeUtility("mask-x-from", "from", { top: false, right: true, bottom: false, left: true });
    maskEdgeUtility("mask-x-to", "to", { top: false, right: true, bottom: false, left: true });
    maskEdgeUtility("mask-y-from", "from", { top: true, right: false, bottom: true, left: false });
    maskEdgeUtility("mask-y-to", "to", { top: true, right: false, bottom: true, left: false });
    maskEdgeUtility("mask-t-from", "from", { top: true, right: false, bottom: false, left: false });
    maskEdgeUtility("mask-t-to", "to", { top: true, right: false, bottom: false, left: false });
    maskEdgeUtility("mask-r-from", "from", { top: false, right: true, bottom: false, left: false });
    maskEdgeUtility("mask-r-to", "to", { top: false, right: true, bottom: false, left: false });
    maskEdgeUtility("mask-b-from", "from", { top: false, right: false, bottom: true, left: false });
    maskEdgeUtility("mask-b-to", "to", { top: false, right: false, bottom: true, left: false });
    maskEdgeUtility("mask-l-from", "from", { top: false, right: false, bottom: false, left: true });
    maskEdgeUtility("mask-l-to", "to", { top: false, right: false, bottom: false, left: true });
    let maskPropertiesLinear = () => atRoot([
      property("--tw-mask-linear-position", "0deg"),
      property("--tw-mask-linear-from-position", "0%"),
      property("--tw-mask-linear-to-position", "100%"),
      property("--tw-mask-linear-from-color", "black"),
      property("--tw-mask-linear-to-color", "transparent")
    ]);
    functionalUtility("mask-linear", {
      defaultValue: null,
      supportsNegative: true,
      supportsFractions: false,
      handleBareValue({ value: value2 }) {
        if (!isPositiveInteger(value2)) return null;
        let valueAsNumber = Number(value2);
        if (valueAsNumber === 0) return "0deg";
        if (valueAsNumber === 1) return "1deg";
        return `calc(1deg * ${value2})`;
      },
      handleNegativeBareValue({ value: value2 }) {
        if (!isPositiveInteger(value2)) return null;
        let valueAsNumber = Number(value2);
        if (valueAsNumber === 0) return "0deg";
        if (valueAsNumber === 1) return "-1deg";
        return `calc(1deg * -${value2})`;
      },
      handle: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesLinear(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-linear",
          `linear-gradient(var(--tw-mask-linear-stops, var(--tw-mask-linear-position)))`
        ),
        decl("--tw-mask-linear-position", value2)
      ]
    });
    suggest("mask-linear", () => [
      {
        supportsNegative: true,
        values: ["0", "1", "2", "3", "6", "12", "45", "90", "180"]
      }
    ]);
    maskStopUtility("mask-linear-from", {
      color: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesLinear(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-linear-stops",
          "var(--tw-mask-linear-position), var(--tw-mask-linear-from-color) var(--tw-mask-linear-from-position), var(--tw-mask-linear-to-color) var(--tw-mask-linear-to-position)"
        ),
        decl("--tw-mask-linear", "linear-gradient(var(--tw-mask-linear-stops))"),
        decl("--tw-mask-linear-from-color", value2)
      ],
      position: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesLinear(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-linear-stops",
          "var(--tw-mask-linear-position), var(--tw-mask-linear-from-color) var(--tw-mask-linear-from-position), var(--tw-mask-linear-to-color) var(--tw-mask-linear-to-position)"
        ),
        decl("--tw-mask-linear", "linear-gradient(var(--tw-mask-linear-stops))"),
        decl("--tw-mask-linear-from-position", value2)
      ]
    });
    maskStopUtility("mask-linear-to", {
      color: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesLinear(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-linear-stops",
          "var(--tw-mask-linear-position), var(--tw-mask-linear-from-color) var(--tw-mask-linear-from-position), var(--tw-mask-linear-to-color) var(--tw-mask-linear-to-position)"
        ),
        decl("--tw-mask-linear", "linear-gradient(var(--tw-mask-linear-stops))"),
        decl("--tw-mask-linear-to-color", value2)
      ],
      position: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesLinear(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-linear-stops",
          "var(--tw-mask-linear-position), var(--tw-mask-linear-from-color) var(--tw-mask-linear-from-position), var(--tw-mask-linear-to-color) var(--tw-mask-linear-to-position)"
        ),
        decl("--tw-mask-linear", "linear-gradient(var(--tw-mask-linear-stops))"),
        decl("--tw-mask-linear-to-position", value2)
      ]
    });
    let maskPropertiesRadial = () => atRoot([
      property("--tw-mask-radial-from-position", "0%"),
      property("--tw-mask-radial-to-position", "100%"),
      property("--tw-mask-radial-from-color", "black"),
      property("--tw-mask-radial-to-color", "transparent"),
      property("--tw-mask-radial-shape", "ellipse"),
      property("--tw-mask-radial-size", "farthest-corner"),
      property("--tw-mask-radial-position", "center")
    ]);
    staticUtility("mask-circle", [["--tw-mask-radial-shape", "circle"]]);
    staticUtility("mask-ellipse", [["--tw-mask-radial-shape", "ellipse"]]);
    staticUtility("mask-radial-closest-side", [["--tw-mask-radial-size", "closest-side"]]);
    staticUtility("mask-radial-farthest-side", [["--tw-mask-radial-size", "farthest-side"]]);
    staticUtility("mask-radial-closest-corner", [["--tw-mask-radial-size", "closest-corner"]]);
    staticUtility("mask-radial-farthest-corner", [["--tw-mask-radial-size", "farthest-corner"]]);
    staticUtility("mask-radial-at-top", [["--tw-mask-radial-position", "top"]]);
    staticUtility("mask-radial-at-top-left", [["--tw-mask-radial-position", "top left"]]);
    staticUtility("mask-radial-at-top-right", [["--tw-mask-radial-position", "top right"]]);
    staticUtility("mask-radial-at-bottom", [["--tw-mask-radial-position", "bottom"]]);
    staticUtility("mask-radial-at-bottom-left", [["--tw-mask-radial-position", "bottom left"]]);
    staticUtility("mask-radial-at-bottom-right", [["--tw-mask-radial-position", "bottom right"]]);
    staticUtility("mask-radial-at-left", [["--tw-mask-radial-position", "left"]]);
    staticUtility("mask-radial-at-right", [["--tw-mask-radial-position", "right"]]);
    staticUtility("mask-radial-at-center", [["--tw-mask-radial-position", "center"]]);
    functionalUtility("mask-radial-at", {
      defaultValue: null,
      supportsNegative: false,
      supportsFractions: false,
      handle: (value2) => [decl("--tw-mask-radial-position", value2)]
    });
    functionalUtility("mask-radial", {
      defaultValue: null,
      supportsNegative: false,
      supportsFractions: false,
      handle: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesRadial(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-radial",
          "radial-gradient(var(--tw-mask-radial-stops, var(--tw-mask-radial-size)))"
        ),
        decl("--tw-mask-radial-size", value2)
      ]
    });
    maskStopUtility("mask-radial-from", {
      color: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesRadial(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-radial-stops",
          "var(--tw-mask-radial-shape) var(--tw-mask-radial-size) at var(--tw-mask-radial-position), var(--tw-mask-radial-from-color) var(--tw-mask-radial-from-position), var(--tw-mask-radial-to-color) var(--tw-mask-radial-to-position)"
        ),
        decl("--tw-mask-radial", "radial-gradient(var(--tw-mask-radial-stops))"),
        decl("--tw-mask-radial-from-color", value2)
      ],
      position: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesRadial(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-radial-stops",
          "var(--tw-mask-radial-shape) var(--tw-mask-radial-size) at var(--tw-mask-radial-position), var(--tw-mask-radial-from-color) var(--tw-mask-radial-from-position), var(--tw-mask-radial-to-color) var(--tw-mask-radial-to-position)"
        ),
        decl("--tw-mask-radial", "radial-gradient(var(--tw-mask-radial-stops))"),
        decl("--tw-mask-radial-from-position", value2)
      ]
    });
    maskStopUtility("mask-radial-to", {
      color: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesRadial(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-radial-stops",
          "var(--tw-mask-radial-shape) var(--tw-mask-radial-size) at var(--tw-mask-radial-position), var(--tw-mask-radial-from-color) var(--tw-mask-radial-from-position), var(--tw-mask-radial-to-color) var(--tw-mask-radial-to-position)"
        ),
        decl("--tw-mask-radial", "radial-gradient(var(--tw-mask-radial-stops))"),
        decl("--tw-mask-radial-to-color", value2)
      ],
      position: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesRadial(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-radial-stops",
          "var(--tw-mask-radial-shape) var(--tw-mask-radial-size) at var(--tw-mask-radial-position), var(--tw-mask-radial-from-color) var(--tw-mask-radial-from-position), var(--tw-mask-radial-to-color) var(--tw-mask-radial-to-position)"
        ),
        decl("--tw-mask-radial", "radial-gradient(var(--tw-mask-radial-stops))"),
        decl("--tw-mask-radial-to-position", value2)
      ]
    });
    let maskPropertiesConic = () => atRoot([
      property("--tw-mask-conic-position", "0deg"),
      property("--tw-mask-conic-from-position", "0%"),
      property("--tw-mask-conic-to-position", "100%"),
      property("--tw-mask-conic-from-color", "black"),
      property("--tw-mask-conic-to-color", "transparent")
    ]);
    functionalUtility("mask-conic", {
      defaultValue: null,
      supportsNegative: true,
      supportsFractions: false,
      handleBareValue({ value: value2 }) {
        if (!isPositiveInteger(value2)) return null;
        let valueAsNumber = Number(value2);
        if (valueAsNumber === 0) return "0deg";
        if (valueAsNumber === 1) return "1deg";
        return `calc(1deg * ${value2})`;
      },
      handleNegativeBareValue({ value: value2 }) {
        if (!isPositiveInteger(value2)) return null;
        let valueAsNumber = Number(value2);
        if (valueAsNumber === 0) return "0deg";
        if (valueAsNumber === 1) return "-1deg";
        return `calc(1deg * -${value2})`;
      },
      handle: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesConic(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-conic",
          "conic-gradient(var(--tw-mask-conic-stops, var(--tw-mask-conic-position)))"
        ),
        decl("--tw-mask-conic-position", value2)
      ]
    });
    suggest("mask-conic", () => [
      {
        supportsNegative: true,
        values: ["0", "1", "2", "3", "6", "12", "45", "90", "180"]
      }
    ]);
    maskStopUtility("mask-conic-from", {
      color: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesConic(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-conic-stops",
          "from var(--tw-mask-conic-position), var(--tw-mask-conic-from-color) var(--tw-mask-conic-from-position), var(--tw-mask-conic-to-color) var(--tw-mask-conic-to-position)"
        ),
        decl("--tw-mask-conic", "conic-gradient(var(--tw-mask-conic-stops))"),
        decl("--tw-mask-conic-from-color", value2)
      ],
      position: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesConic(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-conic-stops",
          "from var(--tw-mask-conic-position), var(--tw-mask-conic-from-color) var(--tw-mask-conic-from-position), var(--tw-mask-conic-to-color) var(--tw-mask-conic-to-position)"
        ),
        decl("--tw-mask-conic", "conic-gradient(var(--tw-mask-conic-stops))"),
        decl("--tw-mask-conic-from-position", value2)
      ]
    });
    maskStopUtility("mask-conic-to", {
      color: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesConic(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-conic-stops",
          "from var(--tw-mask-conic-position), var(--tw-mask-conic-from-color) var(--tw-mask-conic-from-position), var(--tw-mask-conic-to-color) var(--tw-mask-conic-to-position)"
        ),
        decl("--tw-mask-conic", "conic-gradient(var(--tw-mask-conic-stops))"),
        decl("--tw-mask-conic-to-color", value2)
      ],
      position: (value2) => [
        maskPropertiesGradient(),
        maskPropertiesConic(),
        decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
        decl("mask-composite", "intersect"),
        decl(
          "--tw-mask-conic-stops",
          "from var(--tw-mask-conic-position), var(--tw-mask-conic-from-color) var(--tw-mask-conic-from-position), var(--tw-mask-conic-to-color) var(--tw-mask-conic-to-position)"
        ),
        decl("--tw-mask-conic", "conic-gradient(var(--tw-mask-conic-stops))"),
        decl("--tw-mask-conic-to-position", value2)
      ]
    });
    staticUtility("box-decoration-slice", [
      ["-webkit-box-decoration-break", "slice"],
      ["box-decoration-break", "slice"]
    ]);
    staticUtility("box-decoration-clone", [
      ["-webkit-box-decoration-break", "clone"],
      ["box-decoration-break", "clone"]
    ]);
    staticUtility("bg-clip-text", [["background-clip", "text"]]);
    staticUtility("bg-clip-border", [["background-clip", "border-box"]]);
    staticUtility("bg-clip-padding", [["background-clip", "padding-box"]]);
    staticUtility("bg-clip-content", [["background-clip", "content-box"]]);
    staticUtility("bg-origin-border", [["background-origin", "border-box"]]);
    staticUtility("bg-origin-padding", [["background-origin", "padding-box"]]);
    staticUtility("bg-origin-content", [["background-origin", "content-box"]]);
    for (let value2 of [
      "normal",
      "multiply",
      "screen",
      "overlay",
      "darken",
      "lighten",
      "color-dodge",
      "color-burn",
      "hard-light",
      "soft-light",
      "difference",
      "exclusion",
      "hue",
      "saturation",
      "color",
      "luminosity"
    ]) {
      staticUtility(`bg-blend-${value2}`, [["background-blend-mode", value2]]);
      staticUtility(`mix-blend-${value2}`, [["mix-blend-mode", value2]]);
    }
    staticUtility("mix-blend-plus-darker", [["mix-blend-mode", "plus-darker"]]);
    staticUtility("mix-blend-plus-lighter", [["mix-blend-mode", "plus-lighter"]]);
    staticUtility("fill-none", [["fill", "none"]]);
    utilities2.functional("fill", (candidate) => {
      if (!candidate.value) return;
      if (candidate.value.kind === "arbitrary") {
        let value3 = asColor(candidate.value.value, candidate.modifier, theme2);
        if (value3 === null) return;
        return [decl("fill", value3)];
      }
      let value2 = resolveThemeColor(candidate, theme2, ["--fill", "--color"]);
      if (value2) {
        return [decl("fill", value2)];
      }
    });
    suggest("fill", () => [
      {
        values: ["current", "inherit", "transparent"],
        valueThemeKeys: ["--fill", "--color"],
        modifierThemeKeys: ["--opacity"],
        modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
      }
    ]);
    staticUtility("stroke-none", [["stroke", "none"]]);
    utilities2.functional("stroke", (candidate) => {
      if (!candidate.value) return;
      if (candidate.value.kind === "arbitrary") {
        let value2 = candidate.value.value;
        let type = candidate.value.dataType ?? inferDataType(value2, ["color", "number", "length", "percentage"]);
        switch (type) {
          case "number":
          case "length":
          case "percentage": {
            if (candidate.modifier) return;
            return [decl("stroke-width", value2)];
          }
          default: {
            value2 = asColor(candidate.value.value, candidate.modifier, theme2);
            if (value2 === null) return;
            return [decl("stroke", value2)];
          }
        }
      }
      {
        let value2 = resolveThemeColor(candidate, theme2, ["--stroke", "--color"]);
        if (value2) {
          return [decl("stroke", value2)];
        }
      }
      {
        if (candidate.modifier) return;
        let value2 = theme2.resolve(candidate.value.value, ["--stroke-width"]);
        if (value2) {
          return [decl("stroke-width", value2)];
        } else if (isPositiveInteger(candidate.value.value)) {
          return [decl("stroke-width", candidate.value.value)];
        }
      }
    });
    suggest("stroke", () => [
      {
        values: ["current", "inherit", "transparent"],
        valueThemeKeys: ["--stroke", "--color"],
        modifierThemeKeys: ["--opacity"],
        modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
      },
      {
        values: ["0", "1", "2", "3"],
        valueThemeKeys: ["--stroke-width"]
      }
    ]);
    staticUtility("object-contain", [["object-fit", "contain"]]);
    staticUtility("object-cover", [["object-fit", "cover"]]);
    staticUtility("object-fill", [["object-fit", "fill"]]);
    staticUtility("object-none", [["object-fit", "none"]]);
    staticUtility("object-scale-down", [["object-fit", "scale-down"]]);
    functionalUtility("object", {
      themeKeys: ["--object-position"],
      handle: (value2) => [decl("object-position", value2)],
      staticValues: {
        top: [decl("object-position", "top")],
        "top-left": [decl("object-position", "left top")],
        "top-right": [decl("object-position", "right top")],
        bottom: [decl("object-position", "bottom")],
        "bottom-left": [decl("object-position", "left bottom")],
        "bottom-right": [decl("object-position", "right bottom")],
        left: [decl("object-position", "left")],
        right: [decl("object-position", "right")],
        center: [decl("object-position", "center")]
      }
    });
    for (let [name, property2] of [
      ["p", "padding"],
      ["px", "padding-inline"],
      ["py", "padding-block"],
      ["ps", "padding-inline-start"],
      ["pe", "padding-inline-end"],
      ["pbs", "padding-block-start"],
      ["pbe", "padding-block-end"],
      ["pt", "padding-top"],
      ["pr", "padding-right"],
      ["pb", "padding-bottom"],
      ["pl", "padding-left"]
    ]) {
      spacingUtility(name, ["--padding", "--spacing"], (value2) => [decl(property2, value2)]);
    }
    staticUtility("text-left", [["text-align", "left"]]);
    staticUtility("text-center", [["text-align", "center"]]);
    staticUtility("text-right", [["text-align", "right"]]);
    staticUtility("text-justify", [["text-align", "justify"]]);
    staticUtility("text-start", [["text-align", "start"]]);
    staticUtility("text-end", [["text-align", "end"]]);
    spacingUtility(
      "indent",
      ["--text-indent", "--spacing"],
      (value2) => [decl("text-indent", value2)],
      {
        supportsNegative: true
      }
    );
    staticUtility("align-baseline", [["vertical-align", "baseline"]]);
    staticUtility("align-top", [["vertical-align", "top"]]);
    staticUtility("align-middle", [["vertical-align", "middle"]]);
    staticUtility("align-bottom", [["vertical-align", "bottom"]]);
    staticUtility("align-text-top", [["vertical-align", "text-top"]]);
    staticUtility("align-text-bottom", [["vertical-align", "text-bottom"]]);
    staticUtility("align-sub", [["vertical-align", "sub"]]);
    staticUtility("align-super", [["vertical-align", "super"]]);
    functionalUtility("align", {
      themeKeys: [],
      handle: (value2) => [decl("vertical-align", value2)]
    });
    utilities2.functional("font", (candidate) => {
      if (!candidate.value || candidate.modifier) return;
      if (candidate.value.kind === "arbitrary") {
        let value2 = candidate.value.value;
        let type = candidate.value.dataType ?? inferDataType(value2, ["number", "generic-name", "family-name"]);
        switch (type) {
          case "generic-name":
          case "family-name": {
            return [decl("font-family", value2)];
          }
          default: {
            return [
              atRoot([property("--tw-font-weight")]),
              decl("--tw-font-weight", value2),
              decl("font-weight", value2)
            ];
          }
        }
      }
      {
        let value2 = theme2.resolveWith(
          candidate.value.value,
          ["--font"],
          ["--font-feature-settings", "--font-variation-settings"]
        );
        if (value2) {
          let [families, options = {}] = value2;
          return [
            decl("font-family", families),
            decl("font-feature-settings", options["--font-feature-settings"]),
            decl("font-variation-settings", options["--font-variation-settings"])
          ];
        }
      }
      {
        let value2 = theme2.resolve(candidate.value.value, ["--font-weight"]);
        if (value2) {
          return [
            atRoot([property("--tw-font-weight")]),
            decl("--tw-font-weight", value2),
            decl("font-weight", value2)
          ];
        }
      }
    });
    suggest("font", () => [
      {
        values: [],
        valueThemeKeys: ["--font"]
      },
      {
        values: [],
        valueThemeKeys: ["--font-weight"]
      }
    ]);
    functionalUtility("font-features", {
      themeKeys: [],
      handle: (value2) => [decl("font-feature-settings", value2)]
    });
    staticUtility("uppercase", [["text-transform", "uppercase"]]);
    staticUtility("lowercase", [["text-transform", "lowercase"]]);
    staticUtility("capitalize", [["text-transform", "capitalize"]]);
    staticUtility("normal-case", [["text-transform", "none"]]);
    staticUtility("italic", [["font-style", "italic"]]);
    staticUtility("not-italic", [["font-style", "normal"]]);
    staticUtility("underline", [["text-decoration-line", "underline"]]);
    staticUtility("overline", [["text-decoration-line", "overline"]]);
    staticUtility("line-through", [["text-decoration-line", "line-through"]]);
    staticUtility("no-underline", [["text-decoration-line", "none"]]);
    staticUtility("font-stretch-normal", [["font-stretch", "normal"]]);
    staticUtility("font-stretch-ultra-condensed", [["font-stretch", "ultra-condensed"]]);
    staticUtility("font-stretch-extra-condensed", [["font-stretch", "extra-condensed"]]);
    staticUtility("font-stretch-condensed", [["font-stretch", "condensed"]]);
    staticUtility("font-stretch-semi-condensed", [["font-stretch", "semi-condensed"]]);
    staticUtility("font-stretch-semi-expanded", [["font-stretch", "semi-expanded"]]);
    staticUtility("font-stretch-expanded", [["font-stretch", "expanded"]]);
    staticUtility("font-stretch-extra-expanded", [["font-stretch", "extra-expanded"]]);
    staticUtility("font-stretch-ultra-expanded", [["font-stretch", "ultra-expanded"]]);
    functionalUtility("font-stretch", {
      handleBareValue: ({ value: value2 }) => {
        if (!value2.endsWith("%")) return null;
        let num = Number(value2.slice(0, -1));
        if (!isPositiveInteger(num)) return null;
        if (Number.isNaN(num) || num < 50 || num > 200) return null;
        return value2;
      },
      handle: (value2) => [decl("font-stretch", value2)]
    });
    suggest("font-stretch", () => [
      {
        values: ["50%", "75%", "90%", "95%", "100%", "105%", "110%", "125%", "150%", "200%"]
      }
    ]);
    colorUtility("placeholder", {
      themeKeys: ["--placeholder-color", "--color"],
      handle: (value2) => [
        styleRule("&::placeholder", [decl("--tw-sort", "placeholder-color"), decl("color", value2)])
      ]
    });
    staticUtility("decoration-solid", [["text-decoration-style", "solid"]]);
    staticUtility("decoration-double", [["text-decoration-style", "double"]]);
    staticUtility("decoration-dotted", [["text-decoration-style", "dotted"]]);
    staticUtility("decoration-dashed", [["text-decoration-style", "dashed"]]);
    staticUtility("decoration-wavy", [["text-decoration-style", "wavy"]]);
    staticUtility("decoration-auto", [["text-decoration-thickness", "auto"]]);
    staticUtility("decoration-from-font", [["text-decoration-thickness", "from-font"]]);
    utilities2.functional("decoration", (candidate) => {
      if (!candidate.value) return;
      if (candidate.value.kind === "arbitrary") {
        let value2 = candidate.value.value;
        let type = candidate.value.dataType ?? inferDataType(value2, ["color", "length", "percentage"]);
        switch (type) {
          case "length":
          case "percentage": {
            if (candidate.modifier) return;
            return [decl("text-decoration-thickness", value2)];
          }
          default: {
            value2 = asColor(value2, candidate.modifier, theme2);
            if (value2 === null) return;
            return [decl("text-decoration-color", value2)];
          }
        }
      }
      {
        let value2 = theme2.resolve(candidate.value.value, ["--text-decoration-thickness"]);
        if (value2) {
          if (candidate.modifier) return;
          return [decl("text-decoration-thickness", value2)];
        }
        if (isPositiveInteger(candidate.value.value)) {
          if (candidate.modifier) return;
          return [decl("text-decoration-thickness", `${candidate.value.value}px`)];
        }
      }
      {
        let value2 = resolveThemeColor(candidate, theme2, ["--text-decoration-color", "--color"]);
        if (value2) {
          return [decl("text-decoration-color", value2)];
        }
      }
    });
    suggest("decoration", () => [
      {
        values: ["current", "inherit", "transparent"],
        valueThemeKeys: ["--text-decoration-color", "--color"],
        modifierThemeKeys: ["--opacity"],
        modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
      },
      {
        values: ["0", "1", "2"],
        valueThemeKeys: ["--text-decoration-thickness"]
      }
    ]);
    functionalUtility("animate", {
      themeKeys: ["--animate"],
      handle: (value2) => [decl("animation", value2)],
      staticValues: {
        none: [decl("animation", "none")]
      }
    });
    {
      let cssFilterValue = [
        "var(--tw-blur, )",
        "var(--tw-brightness, )",
        "var(--tw-contrast, )",
        "var(--tw-grayscale, )",
        "var(--tw-hue-rotate, )",
        "var(--tw-invert, )",
        "var(--tw-saturate, )",
        "var(--tw-sepia, )",
        "var(--tw-drop-shadow, )"
      ].join(" ");
      let cssBackdropFilterValue = [
        "var(--tw-backdrop-blur, )",
        "var(--tw-backdrop-brightness, )",
        "var(--tw-backdrop-contrast, )",
        "var(--tw-backdrop-grayscale, )",
        "var(--tw-backdrop-hue-rotate, )",
        "var(--tw-backdrop-invert, )",
        "var(--tw-backdrop-opacity, )",
        "var(--tw-backdrop-saturate, )",
        "var(--tw-backdrop-sepia, )"
      ].join(" ");
      let filterProperties = () => {
        return atRoot([
          property("--tw-blur"),
          property("--tw-brightness"),
          property("--tw-contrast"),
          property("--tw-grayscale"),
          property("--tw-hue-rotate"),
          property("--tw-invert"),
          property("--tw-opacity"),
          property("--tw-saturate"),
          property("--tw-sepia"),
          property("--tw-drop-shadow"),
          property("--tw-drop-shadow-color"),
          property("--tw-drop-shadow-alpha", "100%", "<percentage>"),
          property("--tw-drop-shadow-size")
        ]);
      };
      let backdropFilterProperties = () => {
        return atRoot([
          property("--tw-backdrop-blur"),
          property("--tw-backdrop-brightness"),
          property("--tw-backdrop-contrast"),
          property("--tw-backdrop-grayscale"),
          property("--tw-backdrop-hue-rotate"),
          property("--tw-backdrop-invert"),
          property("--tw-backdrop-opacity"),
          property("--tw-backdrop-saturate"),
          property("--tw-backdrop-sepia")
        ]);
      };
      utilities2.functional("filter", (candidate) => {
        if (candidate.modifier) return;
        if (candidate.value === null) {
          return [filterProperties(), decl("filter", cssFilterValue)];
        }
        if (candidate.value.kind === "arbitrary") {
          return [decl("filter", candidate.value.value)];
        }
        switch (candidate.value.value) {
          case "none":
            return [decl("filter", "none")];
        }
      });
      utilities2.functional("backdrop-filter", (candidate) => {
        if (candidate.modifier) return;
        if (candidate.value === null) {
          return [
            backdropFilterProperties(),
            decl("-webkit-backdrop-filter", cssBackdropFilterValue),
            decl("backdrop-filter", cssBackdropFilterValue)
          ];
        }
        if (candidate.value.kind === "arbitrary") {
          return [
            decl("-webkit-backdrop-filter", candidate.value.value),
            decl("backdrop-filter", candidate.value.value)
          ];
        }
        switch (candidate.value.value) {
          case "none":
            return [decl("-webkit-backdrop-filter", "none"), decl("backdrop-filter", "none")];
        }
      });
      functionalUtility("blur", {
        themeKeys: ["--blur"],
        handle: (value2) => [
          filterProperties(),
          decl("--tw-blur", `blur(${value2})`),
          decl("filter", cssFilterValue)
        ],
        staticValues: {
          none: [filterProperties(), decl("--tw-blur", " "), decl("filter", cssFilterValue)]
        }
      });
      functionalUtility("backdrop-blur", {
        themeKeys: ["--backdrop-blur", "--blur"],
        handle: (value2) => [
          backdropFilterProperties(),
          decl("--tw-backdrop-blur", `blur(${value2})`),
          decl("-webkit-backdrop-filter", cssBackdropFilterValue),
          decl("backdrop-filter", cssBackdropFilterValue)
        ],
        staticValues: {
          none: [
            backdropFilterProperties(),
            decl("--tw-backdrop-blur", " "),
            decl("-webkit-backdrop-filter", cssBackdropFilterValue),
            decl("backdrop-filter", cssBackdropFilterValue)
          ]
        }
      });
      functionalUtility("brightness", {
        themeKeys: ["--brightness"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}%`;
        },
        handle: (value2) => [
          filterProperties(),
          decl("--tw-brightness", `brightness(${value2})`),
          decl("filter", cssFilterValue)
        ]
      });
      functionalUtility("backdrop-brightness", {
        themeKeys: ["--backdrop-brightness", "--brightness"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}%`;
        },
        handle: (value2) => [
          backdropFilterProperties(),
          decl("--tw-backdrop-brightness", `brightness(${value2})`),
          decl("-webkit-backdrop-filter", cssBackdropFilterValue),
          decl("backdrop-filter", cssBackdropFilterValue)
        ]
      });
      suggest("brightness", () => [
        {
          values: ["0", "50", "75", "90", "95", "100", "105", "110", "125", "150", "200"],
          valueThemeKeys: ["--brightness"]
        }
      ]);
      suggest("backdrop-brightness", () => [
        {
          values: ["0", "50", "75", "90", "95", "100", "105", "110", "125", "150", "200"],
          valueThemeKeys: ["--backdrop-brightness", "--brightness"]
        }
      ]);
      functionalUtility("contrast", {
        themeKeys: ["--contrast"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}%`;
        },
        handle: (value2) => [
          filterProperties(),
          decl("--tw-contrast", `contrast(${value2})`),
          decl("filter", cssFilterValue)
        ]
      });
      functionalUtility("backdrop-contrast", {
        themeKeys: ["--backdrop-contrast", "--contrast"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}%`;
        },
        handle: (value2) => [
          backdropFilterProperties(),
          decl("--tw-backdrop-contrast", `contrast(${value2})`),
          decl("-webkit-backdrop-filter", cssBackdropFilterValue),
          decl("backdrop-filter", cssBackdropFilterValue)
        ]
      });
      suggest("contrast", () => [
        {
          values: ["0", "50", "75", "100", "125", "150", "200"],
          valueThemeKeys: ["--contrast"]
        }
      ]);
      suggest("backdrop-contrast", () => [
        {
          values: ["0", "50", "75", "100", "125", "150", "200"],
          valueThemeKeys: ["--backdrop-contrast", "--contrast"]
        }
      ]);
      functionalUtility("grayscale", {
        themeKeys: ["--grayscale"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}%`;
        },
        defaultValue: "100%",
        handle: (value2) => [
          filterProperties(),
          decl("--tw-grayscale", `grayscale(${value2})`),
          decl("filter", cssFilterValue)
        ]
      });
      functionalUtility("backdrop-grayscale", {
        themeKeys: ["--backdrop-grayscale", "--grayscale"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}%`;
        },
        defaultValue: "100%",
        handle: (value2) => [
          backdropFilterProperties(),
          decl("--tw-backdrop-grayscale", `grayscale(${value2})`),
          decl("-webkit-backdrop-filter", cssBackdropFilterValue),
          decl("backdrop-filter", cssBackdropFilterValue)
        ]
      });
      suggest("grayscale", () => [
        {
          values: ["0", "25", "50", "75", "100"],
          valueThemeKeys: ["--grayscale"],
          hasDefaultValue: true
        }
      ]);
      suggest("backdrop-grayscale", () => [
        {
          values: ["0", "25", "50", "75", "100"],
          valueThemeKeys: ["--backdrop-grayscale", "--grayscale"],
          hasDefaultValue: true
        }
      ]);
      functionalUtility("hue-rotate", {
        supportsNegative: true,
        themeKeys: ["--hue-rotate"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}deg`;
        },
        handle: (value2) => [
          filterProperties(),
          decl("--tw-hue-rotate", `hue-rotate(${value2})`),
          decl("filter", cssFilterValue)
        ]
      });
      functionalUtility("backdrop-hue-rotate", {
        supportsNegative: true,
        themeKeys: ["--backdrop-hue-rotate", "--hue-rotate"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}deg`;
        },
        handle: (value2) => [
          backdropFilterProperties(),
          decl("--tw-backdrop-hue-rotate", `hue-rotate(${value2})`),
          decl("-webkit-backdrop-filter", cssBackdropFilterValue),
          decl("backdrop-filter", cssBackdropFilterValue)
        ]
      });
      suggest("hue-rotate", () => [
        {
          values: ["0", "15", "30", "60", "90", "180"],
          valueThemeKeys: ["--hue-rotate"]
        }
      ]);
      suggest("backdrop-hue-rotate", () => [
        {
          values: ["0", "15", "30", "60", "90", "180"],
          valueThemeKeys: ["--backdrop-hue-rotate", "--hue-rotate"]
        }
      ]);
      functionalUtility("invert", {
        themeKeys: ["--invert"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}%`;
        },
        defaultValue: "100%",
        handle: (value2) => [
          filterProperties(),
          decl("--tw-invert", `invert(${value2})`),
          decl("filter", cssFilterValue)
        ]
      });
      functionalUtility("backdrop-invert", {
        themeKeys: ["--backdrop-invert", "--invert"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}%`;
        },
        defaultValue: "100%",
        handle: (value2) => [
          backdropFilterProperties(),
          decl("--tw-backdrop-invert", `invert(${value2})`),
          decl("-webkit-backdrop-filter", cssBackdropFilterValue),
          decl("backdrop-filter", cssBackdropFilterValue)
        ]
      });
      suggest("invert", () => [
        {
          values: ["0", "25", "50", "75", "100"],
          valueThemeKeys: ["--invert"],
          hasDefaultValue: true
        }
      ]);
      suggest("backdrop-invert", () => [
        {
          values: ["0", "25", "50", "75", "100"],
          valueThemeKeys: ["--backdrop-invert", "--invert"],
          hasDefaultValue: true
        }
      ]);
      functionalUtility("saturate", {
        themeKeys: ["--saturate"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}%`;
        },
        handle: (value2) => [
          filterProperties(),
          decl("--tw-saturate", `saturate(${value2})`),
          decl("filter", cssFilterValue)
        ]
      });
      functionalUtility("backdrop-saturate", {
        themeKeys: ["--backdrop-saturate", "--saturate"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}%`;
        },
        handle: (value2) => [
          backdropFilterProperties(),
          decl("--tw-backdrop-saturate", `saturate(${value2})`),
          decl("-webkit-backdrop-filter", cssBackdropFilterValue),
          decl("backdrop-filter", cssBackdropFilterValue)
        ]
      });
      suggest("saturate", () => [
        {
          values: ["0", "50", "100", "150", "200"],
          valueThemeKeys: ["--saturate"]
        }
      ]);
      suggest("backdrop-saturate", () => [
        {
          values: ["0", "50", "100", "150", "200"],
          valueThemeKeys: ["--backdrop-saturate", "--saturate"]
        }
      ]);
      functionalUtility("sepia", {
        themeKeys: ["--sepia"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}%`;
        },
        defaultValue: "100%",
        handle: (value2) => [
          filterProperties(),
          decl("--tw-sepia", `sepia(${value2})`),
          decl("filter", cssFilterValue)
        ]
      });
      functionalUtility("backdrop-sepia", {
        themeKeys: ["--backdrop-sepia", "--sepia"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}%`;
        },
        defaultValue: "100%",
        handle: (value2) => [
          backdropFilterProperties(),
          decl("--tw-backdrop-sepia", `sepia(${value2})`),
          decl("-webkit-backdrop-filter", cssBackdropFilterValue),
          decl("backdrop-filter", cssBackdropFilterValue)
        ]
      });
      suggest("sepia", () => [
        {
          values: ["0", "50", "100"],
          valueThemeKeys: ["--sepia"],
          hasDefaultValue: true
        }
      ]);
      suggest("backdrop-sepia", () => [
        {
          values: ["0", "50", "100"],
          valueThemeKeys: ["--backdrop-sepia", "--sepia"],
          hasDefaultValue: true
        }
      ]);
      staticUtility("drop-shadow-none", [
        filterProperties,
        ["--tw-drop-shadow", " "],
        ["filter", cssFilterValue]
      ]);
      utilities2.functional("drop-shadow", (candidate) => {
        let alpha2;
        if (candidate.modifier) {
          if (candidate.modifier.kind === "arbitrary") {
            alpha2 = candidate.modifier.value;
          } else {
            if (isValidOpacityValue(candidate.modifier.value)) {
              alpha2 = `${candidate.modifier.value}%`;
            }
          }
        }
        if (!candidate.value) {
          let value2 = theme2.get(["--drop-shadow"]);
          let resolved = theme2.resolve(null, ["--drop-shadow"]);
          if (value2 === null || resolved === null) return;
          if (candidate.modifier && !alpha2) return;
          return [
            filterProperties(),
            decl("--tw-drop-shadow-alpha", alpha2),
            ...alphaReplacedDropShadowProperties(
              "--tw-drop-shadow-size",
              value2,
              alpha2,
              (color) => `var(--tw-drop-shadow-color, ${color})`
            ),
            decl(
              "--tw-drop-shadow",
              segment(resolved, ",").map((value3) => `drop-shadow(${value3})`).join(" ")
            ),
            decl("filter", cssFilterValue)
          ];
        }
        if (candidate.value.kind === "arbitrary") {
          let value2 = candidate.value.value;
          let type = candidate.value.dataType ?? inferDataType(value2, ["color"]);
          switch (type) {
            case "color": {
              value2 = asColor(value2, candidate.modifier, theme2);
              if (value2 === null) return;
              return [
                filterProperties(),
                decl("--tw-drop-shadow-color", withAlpha(value2, "var(--tw-drop-shadow-alpha)")),
                decl("--tw-drop-shadow", `var(--tw-drop-shadow-size)`)
              ];
            }
            default: {
              if (candidate.modifier && !alpha2) return;
              return [
                filterProperties(),
                decl("--tw-drop-shadow-alpha", alpha2),
                ...alphaReplacedDropShadowProperties(
                  "--tw-drop-shadow-size",
                  value2,
                  alpha2,
                  (color) => `var(--tw-drop-shadow-color, ${color})`
                ),
                decl("--tw-drop-shadow", `var(--tw-drop-shadow-size)`),
                decl("filter", cssFilterValue)
              ];
            }
          }
        }
        {
          let value2 = theme2.get([`--drop-shadow-${candidate.value.value}`]);
          let resolved = theme2.resolve(candidate.value.value, ["--drop-shadow"]);
          if (value2 && resolved) {
            if (candidate.modifier && !alpha2) return;
            if (alpha2) {
              return [
                filterProperties(),
                decl("--tw-drop-shadow-alpha", alpha2),
                ...alphaReplacedDropShadowProperties(
                  "--tw-drop-shadow-size",
                  value2,
                  alpha2,
                  (color) => `var(--tw-drop-shadow-color, ${color})`
                ),
                decl("--tw-drop-shadow", `var(--tw-drop-shadow-size)`),
                decl("filter", cssFilterValue)
              ];
            }
            return [
              filterProperties(),
              decl("--tw-drop-shadow-alpha", alpha2),
              ...alphaReplacedDropShadowProperties(
                "--tw-drop-shadow-size",
                value2,
                alpha2,
                (color) => `var(--tw-drop-shadow-color, ${color})`
              ),
              decl(
                "--tw-drop-shadow",
                segment(resolved, ",").map((value3) => `drop-shadow(${value3})`).join(" ")
              ),
              decl("filter", cssFilterValue)
            ];
          }
        }
        {
          let value2 = resolveThemeColor(candidate, theme2, ["--drop-shadow-color", "--color"]);
          if (value2) {
            if (value2 === "inherit") {
              return [
                filterProperties(),
                decl("--tw-drop-shadow-color", "inherit"),
                decl("--tw-drop-shadow", `var(--tw-drop-shadow-size)`)
              ];
            }
            return [
              filterProperties(),
              decl("--tw-drop-shadow-color", withAlpha(value2, "var(--tw-drop-shadow-alpha)")),
              decl("--tw-drop-shadow", `var(--tw-drop-shadow-size)`)
            ];
          }
        }
      });
      suggest("drop-shadow", () => [
        {
          values: ["current", "inherit", "transparent"],
          valueThemeKeys: ["--drop-shadow-color", "--color"],
          modifierThemeKeys: ["--opacity"],
          modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
        },
        {
          valueThemeKeys: ["--drop-shadow"]
        }
      ]);
      functionalUtility("backdrop-opacity", {
        themeKeys: ["--backdrop-opacity", "--opacity"],
        handleBareValue: ({ value: value2 }) => {
          if (!isValidOpacityValue(value2)) return null;
          return `${value2}%`;
        },
        handle: (value2) => [
          backdropFilterProperties(),
          decl("--tw-backdrop-opacity", `opacity(${value2})`),
          decl("-webkit-backdrop-filter", cssBackdropFilterValue),
          decl("backdrop-filter", cssBackdropFilterValue)
        ]
      });
      suggest("backdrop-opacity", () => [
        {
          values: Array.from({ length: 21 }, (_, i) => `${i * 5}`),
          valueThemeKeys: ["--backdrop-opacity", "--opacity"]
        }
      ]);
    }
    {
      let defaultTimingFunction = `var(--tw-ease, ${theme2.resolve(null, ["--default-transition-timing-function"]) ?? "ease"})`;
      let defaultDuration = `var(--tw-duration, ${theme2.resolve(null, ["--default-transition-duration"]) ?? "0s"})`;
      functionalUtility("transition", {
        defaultValue: "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events",
        themeKeys: ["--transition-property"],
        handle: (value2) => [
          decl("transition-property", value2),
          decl("transition-timing-function", defaultTimingFunction),
          decl("transition-duration", defaultDuration)
        ],
        staticValues: {
          none: [decl("transition-property", "none")],
          all: [
            decl("transition-property", "all"),
            decl("transition-timing-function", defaultTimingFunction),
            decl("transition-duration", defaultDuration)
          ],
          colors: [
            decl(
              "transition-property",
              "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"
            ),
            decl("transition-timing-function", defaultTimingFunction),
            decl("transition-duration", defaultDuration)
          ],
          opacity: [
            decl("transition-property", "opacity"),
            decl("transition-timing-function", defaultTimingFunction),
            decl("transition-duration", defaultDuration)
          ],
          shadow: [
            decl("transition-property", "box-shadow"),
            decl("transition-timing-function", defaultTimingFunction),
            decl("transition-duration", defaultDuration)
          ],
          transform: [
            decl("transition-property", "transform, translate, scale, rotate"),
            decl("transition-timing-function", defaultTimingFunction),
            decl("transition-duration", defaultDuration)
          ]
        }
      });
      staticUtility("transition-discrete", [["transition-behavior", "allow-discrete"]]);
      staticUtility("transition-normal", [["transition-behavior", "normal"]]);
      functionalUtility("delay", {
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}ms`;
        },
        themeKeys: ["--transition-delay"],
        handle: (value2) => [decl("transition-delay", value2)]
      });
      {
        let transitionDurationProperty = () => {
          return atRoot([property("--tw-duration")]);
        };
        staticUtility("duration-initial", [transitionDurationProperty, ["--tw-duration", "initial"]]);
        utilities2.functional("duration", (candidate) => {
          if (candidate.modifier) return;
          if (!candidate.value) return;
          let value2 = null;
          if (candidate.value.kind === "arbitrary") {
            value2 = candidate.value.value;
          } else {
            value2 = theme2.resolve(candidate.value.fraction ?? candidate.value.value, [
              "--transition-duration"
            ]);
            if (value2 === null && isPositiveInteger(candidate.value.value)) {
              value2 = `${candidate.value.value}ms`;
            }
          }
          if (value2 === null) return;
          return [
            transitionDurationProperty(),
            decl("--tw-duration", value2),
            decl("transition-duration", value2)
          ];
        });
      }
      suggest("delay", () => [
        {
          values: ["75", "100", "150", "200", "300", "500", "700", "1000"],
          valueThemeKeys: ["--transition-delay"]
        }
      ]);
      suggest("duration", () => [
        {
          values: ["75", "100", "150", "200", "300", "500", "700", "1000"],
          valueThemeKeys: ["--transition-duration"]
        }
      ]);
    }
    {
      let transitionTimingFunctionProperty = () => {
        return atRoot([property("--tw-ease")]);
      };
      functionalUtility("ease", {
        themeKeys: ["--ease"],
        handle: (value2) => [
          transitionTimingFunctionProperty(),
          decl("--tw-ease", value2),
          decl("transition-timing-function", value2)
        ],
        staticValues: {
          initial: [transitionTimingFunctionProperty(), decl("--tw-ease", "initial")],
          linear: [
            transitionTimingFunctionProperty(),
            decl("--tw-ease", "linear"),
            decl("transition-timing-function", "linear")
          ]
        }
      });
    }
    staticUtility("will-change-auto", [["will-change", "auto"]]);
    staticUtility("will-change-scroll", [["will-change", "scroll-position"]]);
    staticUtility("will-change-contents", [["will-change", "contents"]]);
    staticUtility("will-change-transform", [["will-change", "transform"]]);
    functionalUtility("will-change", {
      themeKeys: [],
      handle: (value2) => [decl("will-change", value2)]
    });
    staticUtility("content-none", [
      ["--tw-content", "none"],
      ["content", "none"]
    ]);
    functionalUtility("content", {
      // BC: We only read from the `--content` theme key for compatibility reasons. It's recommended
      // to use the utility with arbitrary values instead.
      themeKeys: ["--content"],
      handle: (value2) => [
        atRoot([property("--tw-content", '""')]),
        decl("--tw-content", value2),
        decl("content", "var(--tw-content)")
      ]
    });
    {
      let cssContainValue = "var(--tw-contain-size, ) var(--tw-contain-layout, ) var(--tw-contain-paint, ) var(--tw-contain-style, )";
      let cssContainProperties = () => {
        return atRoot([
          property("--tw-contain-size"),
          property("--tw-contain-layout"),
          property("--tw-contain-paint"),
          property("--tw-contain-style")
        ]);
      };
      staticUtility("contain-none", [["contain", "none"]]);
      staticUtility("contain-content", [["contain", "content"]]);
      staticUtility("contain-strict", [["contain", "strict"]]);
      staticUtility("contain-size", [
        cssContainProperties,
        ["--tw-contain-size", "size"],
        ["contain", cssContainValue]
      ]);
      staticUtility("contain-inline-size", [
        cssContainProperties,
        ["--tw-contain-size", "inline-size"],
        ["contain", cssContainValue]
      ]);
      staticUtility("contain-layout", [
        cssContainProperties,
        ["--tw-contain-layout", "layout"],
        ["contain", cssContainValue]
      ]);
      staticUtility("contain-paint", [
        cssContainProperties,
        ["--tw-contain-paint", "paint"],
        ["contain", cssContainValue]
      ]);
      staticUtility("contain-style", [
        cssContainProperties,
        ["--tw-contain-style", "style"],
        ["contain", cssContainValue]
      ]);
      functionalUtility("contain", {
        themeKeys: [],
        handle: (value2) => [decl("contain", value2)]
      });
    }
    staticUtility("forced-color-adjust-none", [["forced-color-adjust", "none"]]);
    staticUtility("forced-color-adjust-auto", [["forced-color-adjust", "auto"]]);
    spacingUtility(
      "leading",
      ["--leading", "--spacing"],
      (value2) => [
        atRoot([property("--tw-leading")]),
        decl("--tw-leading", value2),
        decl("line-height", value2)
      ],
      {
        staticValues: {
          none: [
            atRoot([property("--tw-leading")]),
            decl("--tw-leading", "1"),
            decl("line-height", "1")
          ]
        }
      }
    );
    functionalUtility("tracking", {
      supportsNegative: true,
      themeKeys: ["--tracking"],
      handle: (value2) => [
        atRoot([property("--tw-tracking")]),
        decl("--tw-tracking", value2),
        decl("letter-spacing", value2)
      ]
    });
    staticUtility("antialiased", [
      ["-webkit-font-smoothing", "antialiased"],
      ["-moz-osx-font-smoothing", "grayscale"]
    ]);
    staticUtility("subpixel-antialiased", [
      ["-webkit-font-smoothing", "auto"],
      ["-moz-osx-font-smoothing", "auto"]
    ]);
    {
      let cssFontVariantNumericValue = "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )";
      let fontVariantNumericProperties = () => {
        return atRoot([
          property("--tw-ordinal"),
          property("--tw-slashed-zero"),
          property("--tw-numeric-figure"),
          property("--tw-numeric-spacing"),
          property("--tw-numeric-fraction")
        ]);
      };
      staticUtility("normal-nums", [["font-variant-numeric", "normal"]]);
      staticUtility("ordinal", [
        fontVariantNumericProperties,
        ["--tw-ordinal", "ordinal"],
        ["font-variant-numeric", cssFontVariantNumericValue]
      ]);
      staticUtility("slashed-zero", [
        fontVariantNumericProperties,
        ["--tw-slashed-zero", "slashed-zero"],
        ["font-variant-numeric", cssFontVariantNumericValue]
      ]);
      staticUtility("lining-nums", [
        fontVariantNumericProperties,
        ["--tw-numeric-figure", "lining-nums"],
        ["font-variant-numeric", cssFontVariantNumericValue]
      ]);
      staticUtility("oldstyle-nums", [
        fontVariantNumericProperties,
        ["--tw-numeric-figure", "oldstyle-nums"],
        ["font-variant-numeric", cssFontVariantNumericValue]
      ]);
      staticUtility("proportional-nums", [
        fontVariantNumericProperties,
        ["--tw-numeric-spacing", "proportional-nums"],
        ["font-variant-numeric", cssFontVariantNumericValue]
      ]);
      staticUtility("tabular-nums", [
        fontVariantNumericProperties,
        ["--tw-numeric-spacing", "tabular-nums"],
        ["font-variant-numeric", cssFontVariantNumericValue]
      ]);
      staticUtility("diagonal-fractions", [
        fontVariantNumericProperties,
        ["--tw-numeric-fraction", "diagonal-fractions"],
        ["font-variant-numeric", cssFontVariantNumericValue]
      ]);
      staticUtility("stacked-fractions", [
        fontVariantNumericProperties,
        ["--tw-numeric-fraction", "stacked-fractions"],
        ["font-variant-numeric", cssFontVariantNumericValue]
      ]);
    }
    {
      let outlineProperties = () => {
        return atRoot([property("--tw-outline-style", "solid")]);
      };
      utilities2.static("outline-hidden", () => {
        return [
          decl("--tw-outline-style", "none"),
          decl("outline-style", "none"),
          atRule("@media", "(forced-colors: active)", [
            decl("outline", "2px solid transparent"),
            decl("outline-offset", "2px")
          ])
        ];
      });
      staticUtility("outline-none", [
        ["--tw-outline-style", "none"],
        ["outline-style", "none"]
      ]);
      staticUtility("outline-solid", [
        ["--tw-outline-style", "solid"],
        ["outline-style", "solid"]
      ]);
      staticUtility("outline-dashed", [
        ["--tw-outline-style", "dashed"],
        ["outline-style", "dashed"]
      ]);
      staticUtility("outline-dotted", [
        ["--tw-outline-style", "dotted"],
        ["outline-style", "dotted"]
      ]);
      staticUtility("outline-double", [
        ["--tw-outline-style", "double"],
        ["outline-style", "double"]
      ]);
      utilities2.functional("outline", (candidate) => {
        if (candidate.value === null) {
          if (candidate.modifier) return;
          let value2 = theme2.get(["--default-outline-width"]) ?? "1px";
          return [
            outlineProperties(),
            decl("outline-style", "var(--tw-outline-style)"),
            decl("outline-width", value2)
          ];
        }
        if (candidate.value.kind === "arbitrary") {
          let value2 = candidate.value.value;
          let type = candidate.value.dataType ?? inferDataType(value2, ["color", "length", "number", "percentage"]);
          switch (type) {
            case "length":
            case "number":
            case "percentage": {
              if (candidate.modifier) return;
              return [
                outlineProperties(),
                decl("outline-style", "var(--tw-outline-style)"),
                decl("outline-width", value2)
              ];
            }
            default: {
              value2 = asColor(value2, candidate.modifier, theme2);
              if (value2 === null) return;
              return [decl("outline-color", value2)];
            }
          }
        }
        {
          let value2 = resolveThemeColor(candidate, theme2, ["--outline-color", "--color"]);
          if (value2) {
            return [decl("outline-color", value2)];
          }
        }
        {
          if (candidate.modifier) return;
          let value2 = theme2.resolve(candidate.value.value, ["--outline-width"]);
          if (value2) {
            return [
              outlineProperties(),
              decl("outline-style", "var(--tw-outline-style)"),
              decl("outline-width", value2)
            ];
          } else if (isPositiveInteger(candidate.value.value)) {
            return [
              outlineProperties(),
              decl("outline-style", "var(--tw-outline-style)"),
              decl("outline-width", `${candidate.value.value}px`)
            ];
          }
        }
      });
      suggest("outline", () => [
        {
          values: ["current", "inherit", "transparent"],
          valueThemeKeys: ["--outline-color", "--color"],
          modifierThemeKeys: ["--opacity"],
          modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`),
          hasDefaultValue: true
        },
        {
          values: ["0", "1", "2", "4", "8"],
          valueThemeKeys: ["--outline-width"]
        }
      ]);
      functionalUtility("outline-offset", {
        supportsNegative: true,
        themeKeys: ["--outline-offset"],
        handleBareValue: ({ value: value2 }) => {
          if (!isPositiveInteger(value2)) return null;
          return `${value2}px`;
        },
        handle: (value2) => [decl("outline-offset", value2)]
      });
      suggest("outline-offset", () => [
        {
          supportsNegative: true,
          values: ["0", "1", "2", "4", "8"],
          valueThemeKeys: ["--outline-offset"]
        }
      ]);
    }
    functionalUtility("opacity", {
      themeKeys: ["--opacity"],
      handleBareValue: ({ value: value2 }) => {
        if (!isValidOpacityValue(value2)) return null;
        return `${value2}%`;
      },
      handle: (value2) => [decl("opacity", value2)]
    });
    suggest("opacity", () => [
      {
        values: Array.from({ length: 21 }, (_, i) => `${i * 5}`),
        valueThemeKeys: ["--opacity"]
      }
    ]);
    functionalUtility("underline-offset", {
      supportsNegative: true,
      themeKeys: ["--text-underline-offset"],
      handleBareValue: ({ value: value2 }) => {
        if (!isPositiveInteger(value2)) return null;
        return `${value2}px`;
      },
      handle: (value2) => [decl("text-underline-offset", value2)],
      staticValues: {
        auto: [decl("text-underline-offset", "auto")]
      }
    });
    suggest("underline-offset", () => [
      {
        supportsNegative: true,
        values: ["0", "1", "2", "4", "8"],
        valueThemeKeys: ["--text-underline-offset"]
      }
    ]);
    utilities2.functional("text", (candidate) => {
      if (!candidate.value) return;
      if (candidate.value.kind === "arbitrary") {
        let value2 = candidate.value.value;
        let type = candidate.value.dataType ?? inferDataType(value2, ["color", "length", "percentage", "absolute-size", "relative-size"]);
        switch (type) {
          case "size":
          case "length":
          case "percentage":
          case "absolute-size":
          case "relative-size": {
            if (candidate.modifier) {
              let modifier = candidate.modifier.kind === "arbitrary" ? candidate.modifier.value : theme2.resolve(candidate.modifier.value, ["--leading"]);
              if (!modifier && isValidSpacingMultiplier(candidate.modifier.value)) {
                let multiplier = theme2.resolve(null, ["--spacing"]);
                if (!multiplier) return null;
                modifier = `--spacing(${candidate.modifier.value})`;
              }
              if (!modifier && candidate.modifier.value === "none") {
                modifier = "1";
              }
              if (modifier) {
                return [decl("font-size", value2), decl("line-height", modifier)];
              }
              return null;
            }
            return [decl("font-size", value2)];
          }
          default: {
            value2 = asColor(value2, candidate.modifier, theme2);
            if (value2 === null) return;
            return [decl("color", value2)];
          }
        }
      }
      {
        let value2 = resolveThemeColor(candidate, theme2, ["--text-color", "--color"]);
        if (value2) {
          return [decl("color", value2)];
        }
      }
      {
        let value2 = theme2.resolveWith(
          candidate.value.value,
          ["--text"],
          ["--line-height", "--letter-spacing", "--font-weight"]
        );
        if (value2) {
          let [fontSize, options = {}] = Array.isArray(value2) ? value2 : [value2];
          if (candidate.modifier) {
            let modifier = candidate.modifier.kind === "arbitrary" ? candidate.modifier.value : theme2.resolve(candidate.modifier.value, ["--leading"]);
            if (!modifier && isValidSpacingMultiplier(candidate.modifier.value)) {
              let multiplier = theme2.resolve(null, ["--spacing"]);
              if (!multiplier) return null;
              modifier = `--spacing(${candidate.modifier.value})`;
            }
            if (!modifier && candidate.modifier.value === "none") {
              modifier = "1";
            }
            if (!modifier) {
              return null;
            }
            let declarations = [decl("font-size", fontSize)];
            modifier && declarations.push(decl("line-height", modifier));
            return declarations;
          }
          if (typeof options === "string") {
            return [decl("font-size", fontSize), decl("line-height", options)];
          }
          return [
            decl("font-size", fontSize),
            decl(
              "line-height",
              options["--line-height"] ? `var(--tw-leading, ${options["--line-height"]})` : void 0
            ),
            decl(
              "letter-spacing",
              options["--letter-spacing"] ? `var(--tw-tracking, ${options["--letter-spacing"]})` : void 0
            ),
            decl(
              "font-weight",
              options["--font-weight"] ? `var(--tw-font-weight, ${options["--font-weight"]})` : void 0
            )
          ];
        }
      }
    });
    suggest("text", () => [
      {
        values: ["current", "inherit", "transparent"],
        valueThemeKeys: ["--text-color", "--color"],
        modifierThemeKeys: ["--opacity"],
        modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
      },
      {
        values: [],
        valueThemeKeys: ["--text"],
        modifiers: [],
        modifierThemeKeys: ["--leading"]
      }
    ]);
    let textShadowProperties = () => {
      return atRoot([
        property("--tw-text-shadow-color"),
        property("--tw-text-shadow-alpha", "100%", "<percentage>")
      ]);
    };
    staticUtility("text-shadow-initial", [
      textShadowProperties,
      ["--tw-text-shadow-color", "initial"]
    ]);
    utilities2.functional("text-shadow", (candidate) => {
      let alpha2;
      if (candidate.modifier) {
        if (candidate.modifier.kind === "arbitrary") {
          alpha2 = candidate.modifier.value;
        } else {
          if (isValidOpacityValue(candidate.modifier.value)) {
            alpha2 = `${candidate.modifier.value}%`;
          }
        }
      }
      if (!candidate.value) {
        let value2 = theme2.get(["--text-shadow"]);
        if (value2 === null) return;
        if (candidate.modifier && !alpha2) return;
        return [
          textShadowProperties(),
          decl("--tw-text-shadow-alpha", alpha2),
          ...alphaReplacedShadowProperties(
            "text-shadow",
            value2,
            alpha2,
            (color) => `var(--tw-text-shadow-color, ${color})`
          )
        ];
      }
      if (candidate.value.kind === "arbitrary") {
        let value2 = candidate.value.value;
        let type = candidate.value.dataType ?? inferDataType(value2, ["color"]);
        switch (type) {
          case "color": {
            value2 = asColor(value2, candidate.modifier, theme2);
            if (value2 === null) return;
            return [
              textShadowProperties(),
              decl("--tw-text-shadow-color", withAlpha(value2, "var(--tw-text-shadow-alpha)"))
            ];
          }
          default: {
            if (candidate.modifier && !alpha2) return;
            return [
              textShadowProperties(),
              decl("--tw-text-shadow-alpha", alpha2),
              ...alphaReplacedShadowProperties(
                "text-shadow",
                value2,
                alpha2,
                (color) => `var(--tw-text-shadow-color, ${color})`
              )
            ];
          }
        }
      }
      switch (candidate.value.value) {
        case "none":
          if (candidate.modifier) return;
          return [textShadowProperties(), decl("text-shadow", "none")];
        case "inherit":
          if (candidate.modifier) return;
          return [textShadowProperties(), decl("--tw-text-shadow-color", "inherit")];
      }
      {
        let value2 = theme2.get([`--text-shadow-${candidate.value.value}`]);
        if (value2) {
          if (candidate.modifier && !alpha2) return;
          return [
            textShadowProperties(),
            decl("--tw-text-shadow-alpha", alpha2),
            ...alphaReplacedShadowProperties(
              "text-shadow",
              value2,
              alpha2,
              (color) => `var(--tw-text-shadow-color, ${color})`
            )
          ];
        }
      }
      {
        let value2 = resolveThemeColor(candidate, theme2, ["--text-shadow-color", "--color"]);
        if (value2) {
          return [
            textShadowProperties(),
            decl("--tw-text-shadow-color", withAlpha(value2, "var(--tw-text-shadow-alpha)"))
          ];
        }
      }
    });
    suggest("text-shadow", () => [
      {
        values: ["current", "inherit", "transparent"],
        valueThemeKeys: ["--text-shadow-color", "--color"],
        modifierThemeKeys: ["--opacity"],
        modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
      },
      {
        values: ["none"]
      },
      {
        valueThemeKeys: ["--text-shadow"],
        modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`),
        hasDefaultValue: theme2.get(["--text-shadow"]) !== null
      }
    ]);
    {
      let ringShadowValue2 = function(value2) {
        return `var(--tw-ring-inset, ) 0 0 0 calc(${value2} + var(--tw-ring-offset-width)) var(--tw-ring-color, ${defaultRingColor})`;
      }, insetRingShadowValue2 = function(value2) {
        return `inset 0 0 0 ${value2} var(--tw-inset-ring-color, currentcolor)`;
      };
      var ringShadowValue = ringShadowValue2, insetRingShadowValue = insetRingShadowValue2;
      let cssBoxShadowValue = [
        "var(--tw-inset-shadow)",
        "var(--tw-inset-ring-shadow)",
        "var(--tw-ring-offset-shadow)",
        "var(--tw-ring-shadow)",
        "var(--tw-shadow)"
      ].join(", ");
      let nullShadow = "0 0 #0000";
      let boxShadowProperties = () => {
        return atRoot([
          property("--tw-shadow", nullShadow),
          property("--tw-shadow-color"),
          property("--tw-shadow-alpha", "100%", "<percentage>"),
          property("--tw-inset-shadow", nullShadow),
          property("--tw-inset-shadow-color"),
          property("--tw-inset-shadow-alpha", "100%", "<percentage>"),
          property("--tw-ring-color"),
          property("--tw-ring-shadow", nullShadow),
          property("--tw-inset-ring-color"),
          property("--tw-inset-ring-shadow", nullShadow),
          // Legacy
          property("--tw-ring-inset"),
          property("--tw-ring-offset-width", "0px", "<length>"),
          property("--tw-ring-offset-color", "#fff"),
          property("--tw-ring-offset-shadow", nullShadow)
        ]);
      };
      staticUtility("shadow-initial", [boxShadowProperties, ["--tw-shadow-color", "initial"]]);
      utilities2.functional("shadow", (candidate) => {
        let alpha2;
        if (candidate.modifier) {
          if (candidate.modifier.kind === "arbitrary") {
            alpha2 = candidate.modifier.value;
          } else {
            if (isValidOpacityValue(candidate.modifier.value)) {
              alpha2 = `${candidate.modifier.value}%`;
            }
          }
        }
        if (!candidate.value) {
          let value2 = theme2.get(["--shadow"]);
          if (value2 === null) return;
          if (candidate.modifier && !alpha2) return;
          return [
            boxShadowProperties(),
            decl("--tw-shadow-alpha", alpha2),
            ...alphaReplacedShadowProperties(
              "--tw-shadow",
              value2,
              alpha2,
              (color) => `var(--tw-shadow-color, ${color})`
            ),
            decl("box-shadow", cssBoxShadowValue)
          ];
        }
        if (candidate.value.kind === "arbitrary") {
          let value2 = candidate.value.value;
          let type = candidate.value.dataType ?? inferDataType(value2, ["color"]);
          switch (type) {
            case "color": {
              value2 = asColor(value2, candidate.modifier, theme2);
              if (value2 === null) return;
              return [
                boxShadowProperties(),
                decl("--tw-shadow-color", withAlpha(value2, "var(--tw-shadow-alpha)"))
              ];
            }
            default: {
              if (candidate.modifier && !alpha2) return;
              return [
                boxShadowProperties(),
                decl("--tw-shadow-alpha", alpha2),
                ...alphaReplacedShadowProperties(
                  "--tw-shadow",
                  value2,
                  alpha2,
                  (color) => `var(--tw-shadow-color, ${color})`
                ),
                decl("box-shadow", cssBoxShadowValue)
              ];
            }
          }
        }
        switch (candidate.value.value) {
          case "none":
            if (candidate.modifier) return;
            return [
              boxShadowProperties(),
              decl("--tw-shadow", nullShadow),
              decl("box-shadow", cssBoxShadowValue)
            ];
          case "inherit":
            if (candidate.modifier) return;
            return [boxShadowProperties(), decl("--tw-shadow-color", "inherit")];
        }
        {
          let value2 = theme2.get([`--shadow-${candidate.value.value}`]);
          if (value2) {
            if (candidate.modifier && !alpha2) return;
            return [
              boxShadowProperties(),
              decl("--tw-shadow-alpha", alpha2),
              ...alphaReplacedShadowProperties(
                "--tw-shadow",
                value2,
                alpha2,
                (color) => `var(--tw-shadow-color, ${color})`
              ),
              decl("box-shadow", cssBoxShadowValue)
            ];
          }
        }
        {
          let value2 = resolveThemeColor(candidate, theme2, ["--box-shadow-color", "--color"]);
          if (value2) {
            return [
              boxShadowProperties(),
              decl("--tw-shadow-color", withAlpha(value2, "var(--tw-shadow-alpha)"))
            ];
          }
        }
      });
      suggest("shadow", () => [
        {
          values: ["current", "inherit", "transparent"],
          valueThemeKeys: ["--box-shadow-color", "--color"],
          modifierThemeKeys: ["--opacity"],
          modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
        },
        {
          values: ["none"]
        },
        {
          valueThemeKeys: ["--shadow"],
          modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`),
          hasDefaultValue: theme2.get(["--shadow"]) !== null
        }
      ]);
      staticUtility("inset-shadow-initial", [
        boxShadowProperties,
        ["--tw-inset-shadow-color", "initial"]
      ]);
      utilities2.functional("inset-shadow", (candidate) => {
        let alpha2;
        if (candidate.modifier) {
          if (candidate.modifier.kind === "arbitrary") {
            alpha2 = candidate.modifier.value;
          } else {
            if (isValidOpacityValue(candidate.modifier.value)) {
              alpha2 = `${candidate.modifier.value}%`;
            }
          }
        }
        if (!candidate.value) {
          let value2 = theme2.get(["--inset-shadow"]);
          if (value2 === null) return;
          if (candidate.modifier && !alpha2) return;
          return [
            boxShadowProperties(),
            decl("--tw-inset-shadow-alpha", alpha2),
            ...alphaReplacedShadowProperties(
              "--tw-inset-shadow",
              value2,
              alpha2,
              (color) => `var(--tw-inset-shadow-color, ${color})`
            ),
            decl("box-shadow", cssBoxShadowValue)
          ];
        }
        if (candidate.value.kind === "arbitrary") {
          let value2 = candidate.value.value;
          let type = candidate.value.dataType ?? inferDataType(value2, ["color"]);
          switch (type) {
            case "color": {
              value2 = asColor(value2, candidate.modifier, theme2);
              if (value2 === null) return;
              return [
                boxShadowProperties(),
                decl("--tw-inset-shadow-color", withAlpha(value2, "var(--tw-inset-shadow-alpha)"))
              ];
            }
            default: {
              if (candidate.modifier && !alpha2) return;
              return [
                boxShadowProperties(),
                decl("--tw-inset-shadow-alpha", alpha2),
                ...alphaReplacedShadowProperties(
                  "--tw-inset-shadow",
                  value2,
                  alpha2,
                  (color) => `var(--tw-inset-shadow-color, ${color})`,
                  "inset"
                ),
                decl("box-shadow", cssBoxShadowValue)
              ];
            }
          }
        }
        switch (candidate.value.value) {
          case "none":
            if (candidate.modifier) return;
            return [
              boxShadowProperties(),
              decl("--tw-inset-shadow", `inset ${nullShadow}`),
              decl("box-shadow", cssBoxShadowValue)
            ];
          case "inherit":
            if (candidate.modifier) return;
            return [boxShadowProperties(), decl("--tw-inset-shadow-color", "inherit")];
        }
        {
          let value2 = theme2.get([`--inset-shadow-${candidate.value.value}`]);
          if (value2) {
            if (candidate.modifier && !alpha2) return;
            return [
              boxShadowProperties(),
              decl("--tw-inset-shadow-alpha", alpha2),
              ...alphaReplacedShadowProperties(
                "--tw-inset-shadow",
                value2,
                alpha2,
                (color) => `var(--tw-inset-shadow-color, ${color})`
              ),
              decl("box-shadow", cssBoxShadowValue)
            ];
          }
        }
        {
          let value2 = resolveThemeColor(candidate, theme2, ["--box-shadow-color", "--color"]);
          if (value2) {
            return [
              boxShadowProperties(),
              decl("--tw-inset-shadow-color", withAlpha(value2, "var(--tw-inset-shadow-alpha)"))
            ];
          }
        }
      });
      suggest("inset-shadow", () => [
        {
          values: ["current", "inherit", "transparent"],
          valueThemeKeys: ["--box-shadow-color", "--color"],
          modifierThemeKeys: ["--opacity"],
          modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
        },
        {
          values: ["none"]
        },
        {
          valueThemeKeys: ["--inset-shadow"],
          modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`),
          hasDefaultValue: theme2.get(["--inset-shadow"]) !== null
        }
      ]);
      staticUtility("ring-inset", [boxShadowProperties, ["--tw-ring-inset", "inset"]]);
      let defaultRingColor = theme2.get(["--default-ring-color"]) ?? "currentcolor";
      utilities2.functional("ring", (candidate) => {
        if (!candidate.value) {
          if (candidate.modifier) return;
          let value2 = theme2.get(["--default-ring-width"]) ?? "1px";
          return [
            boxShadowProperties(),
            decl("--tw-ring-shadow", ringShadowValue2(value2)),
            decl("box-shadow", cssBoxShadowValue)
          ];
        }
        if (candidate.value.kind === "arbitrary") {
          let value2 = candidate.value.value;
          let type = candidate.value.dataType ?? inferDataType(value2, ["color", "length"]);
          switch (type) {
            case "length": {
              if (candidate.modifier) return;
              return [
                boxShadowProperties(),
                decl("--tw-ring-shadow", ringShadowValue2(value2)),
                decl("box-shadow", cssBoxShadowValue)
              ];
            }
            default: {
              value2 = asColor(value2, candidate.modifier, theme2);
              if (value2 === null) return;
              return [decl("--tw-ring-color", value2)];
            }
          }
        }
        {
          let value2 = resolveThemeColor(candidate, theme2, ["--ring-color", "--color"]);
          if (value2) {
            return [decl("--tw-ring-color", value2)];
          }
        }
        {
          if (candidate.modifier) return;
          let value2 = theme2.resolve(candidate.value.value, ["--ring-width"]);
          if (value2 === null && isPositiveInteger(candidate.value.value)) {
            value2 = `${candidate.value.value}px`;
          }
          if (value2) {
            return [
              boxShadowProperties(),
              decl("--tw-ring-shadow", ringShadowValue2(value2)),
              decl("box-shadow", cssBoxShadowValue)
            ];
          }
        }
      });
      suggest("ring", () => [
        {
          values: ["current", "inherit", "transparent"],
          valueThemeKeys: ["--ring-color", "--color"],
          modifierThemeKeys: ["--opacity"],
          modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
        },
        {
          values: ["0", "1", "2", "4", "8"],
          valueThemeKeys: ["--ring-width"],
          hasDefaultValue: true
        }
      ]);
      utilities2.functional("inset-ring", (candidate) => {
        if (!candidate.value) {
          if (candidate.modifier) return;
          return [
            boxShadowProperties(),
            decl("--tw-inset-ring-shadow", insetRingShadowValue2("1px")),
            decl("box-shadow", cssBoxShadowValue)
          ];
        }
        if (candidate.value.kind === "arbitrary") {
          let value2 = candidate.value.value;
          let type = candidate.value.dataType ?? inferDataType(value2, ["color", "length"]);
          switch (type) {
            case "length": {
              if (candidate.modifier) return;
              return [
                boxShadowProperties(),
                decl("--tw-inset-ring-shadow", insetRingShadowValue2(value2)),
                decl("box-shadow", cssBoxShadowValue)
              ];
            }
            default: {
              value2 = asColor(value2, candidate.modifier, theme2);
              if (value2 === null) return;
              return [decl("--tw-inset-ring-color", value2)];
            }
          }
        }
        {
          let value2 = resolveThemeColor(candidate, theme2, ["--ring-color", "--color"]);
          if (value2) {
            return [decl("--tw-inset-ring-color", value2)];
          }
        }
        {
          if (candidate.modifier) return;
          let value2 = theme2.resolve(candidate.value.value, ["--ring-width"]);
          if (value2 === null && isPositiveInteger(candidate.value.value)) {
            value2 = `${candidate.value.value}px`;
          }
          if (value2) {
            return [
              boxShadowProperties(),
              decl("--tw-inset-ring-shadow", insetRingShadowValue2(value2)),
              decl("box-shadow", cssBoxShadowValue)
            ];
          }
        }
      });
      suggest("inset-ring", () => [
        {
          values: ["current", "inherit", "transparent"],
          valueThemeKeys: ["--ring-color", "--color"],
          modifierThemeKeys: ["--opacity"],
          modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
        },
        {
          values: ["0", "1", "2", "4", "8"],
          valueThemeKeys: ["--ring-width"],
          hasDefaultValue: true
        }
      ]);
      let ringOffsetShadowValue = "var(--tw-ring-inset, ) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)";
      utilities2.functional("ring-offset", (candidate) => {
        if (!candidate.value) return;
        if (candidate.value.kind === "arbitrary") {
          let value2 = candidate.value.value;
          let type = candidate.value.dataType ?? inferDataType(value2, ["color", "length"]);
          switch (type) {
            case "length": {
              if (candidate.modifier) return;
              return [
                decl("--tw-ring-offset-width", value2),
                decl("--tw-ring-offset-shadow", ringOffsetShadowValue)
              ];
            }
            default: {
              value2 = asColor(value2, candidate.modifier, theme2);
              if (value2 === null) return;
              return [decl("--tw-ring-offset-color", value2)];
            }
          }
        }
        {
          let value2 = theme2.resolve(candidate.value.value, ["--ring-offset-width"]);
          if (value2) {
            if (candidate.modifier) return;
            return [
              decl("--tw-ring-offset-width", value2),
              decl("--tw-ring-offset-shadow", ringOffsetShadowValue)
            ];
          } else if (isPositiveInteger(candidate.value.value)) {
            if (candidate.modifier) return;
            return [
              decl("--tw-ring-offset-width", `${candidate.value.value}px`),
              decl("--tw-ring-offset-shadow", ringOffsetShadowValue)
            ];
          }
        }
        {
          let value2 = resolveThemeColor(candidate, theme2, ["--ring-offset-color", "--color"]);
          if (value2) {
            return [decl("--tw-ring-offset-color", value2)];
          }
        }
      });
    }
    suggest("ring-offset", () => [
      {
        values: ["current", "inherit", "transparent"],
        valueThemeKeys: ["--ring-offset-color", "--color"],
        modifierThemeKeys: ["--opacity"],
        modifiers: Array.from({ length: 21 }, (_, index) => `${index * 5}`)
      },
      {
        values: ["0", "1", "2", "4", "8"],
        valueThemeKeys: ["--ring-offset-width"]
      }
    ]);
    utilities2.functional("@container", (candidate) => {
      let value2 = null;
      if (candidate.value === null) {
        value2 = "inline-size";
      } else if (candidate.value.kind === "arbitrary") {
        value2 = candidate.value.value;
      } else if (candidate.value.kind === "named" && candidate.value.value === "normal") {
        value2 = "normal";
      } else if (candidate.value.kind === "named" && candidate.value.value === "size") {
        value2 = "size";
      }
      if (value2 === null) return;
      if (candidate.modifier) {
        return [decl("container-type", value2), decl("container-name", candidate.modifier.value)];
      }
      return [decl("container-type", value2)];
    });
    suggest("@container", () => [
      {
        values: ["normal"],
        valueThemeKeys: [],
        hasDefaultValue: true
      }
    ]);
    return utilities2;
  }
  var BARE_VALUE_DATA_TYPES = [
    "number",
    // 2.5
    "integer",
    // 8
    "ratio",
    // 2/3
    "percentage"
    // 25%
  ];
  function createCssUtility(node) {
    let name = unescape(node.params);
    if (isValidFunctionalUtilityName(name)) {
      return (designSystem) => {
        let storage = {
          "--value": {
            usedSpacingInteger: false,
            usedSpacingNumber: false,
            themeKeys: /* @__PURE__ */ new Set(),
            literals: /* @__PURE__ */ new Set()
          },
          "--modifier": {
            usedSpacingInteger: false,
            usedSpacingNumber: false,
            themeKeys: /* @__PURE__ */ new Set(),
            literals: /* @__PURE__ */ new Set()
          }
        };
        walk(node.nodes, (child) => {
          if (child.kind !== "declaration") return;
          if (!child.value) return;
          if (!child.value.includes("--value(") && !child.value.includes("--modifier(")) return;
          let declarationValueAst = parse3(child.value);
          walk(declarationValueAst, (fn) => {
            if (fn.kind !== "function") return;
            if (fn.value === "--spacing" && // Quick bail check if we already know that `--value` and `--modifier` are
            // using the full `--spacing` theme scale.
            !(storage["--modifier"].usedSpacingNumber && storage["--value"].usedSpacingNumber)) {
              walk(fn.nodes, (node2) => {
                if (node2.kind !== "function") return;
                if (node2.value !== "--value" && node2.value !== "--modifier") return;
                const key = node2.value;
                for (let arg of node2.nodes) {
                  if (arg.kind !== "word") continue;
                  if (arg.value === "integer") {
                    storage[key].usedSpacingInteger ||= true;
                  } else if (arg.value === "number") {
                    storage[key].usedSpacingNumber ||= true;
                    if (storage["--modifier"].usedSpacingNumber && storage["--value"].usedSpacingNumber) {
                      return WalkAction.Stop;
                    }
                  }
                }
              });
              return WalkAction.Continue;
            }
            if (fn.value !== "--value" && fn.value !== "--modifier") return;
            let args = segment(toCss2(fn.nodes), ",");
            for (let [idx, arg] of args.entries()) {
              arg = arg.trim();
              if (arg.startsWith("--default(")) {
                args[idx] = arg;
                continue;
              }
              arg = arg.replace(/\\\*/g, "*");
              arg = arg.replace(/--(.*?)\s--(.*?)/g, "--$1-*--$2");
              arg = arg.replace(/\s+/g, "");
              arg = arg.replace(/(-\*){2,}/g, "-*");
              if (arg[0] === "-" && arg[1] === "-" && !arg.includes("(") && !arg.includes("-*")) {
                arg += "-*";
              }
              args[idx] = arg;
            }
            fn.nodes = parse3(args.join(","));
            for (let node2 of fn.nodes) {
              if (node2.kind === "word" && (node2.value[0] === '"' || node2.value[0] === "'") && node2.value[0] === node2.value[node2.value.length - 1]) {
                let value2 = node2.value.slice(1, -1);
                storage[fn.value].literals.add(value2);
              } else if (node2.kind === "word" && node2.value[0] === "-" && node2.value[1] === "-") {
                let value2 = node2.value.replace(/-\*.*$/g, "");
                storage[fn.value].themeKeys.add(value2);
              } else if (node2.kind === "word" && !(node2.value[0] === "[" && node2.value[node2.value.length - 1] === "]") && // Ignore arbitrary values
              !BARE_VALUE_DATA_TYPES.includes(node2.value)) {
                console.warn(
                  `Unsupported bare value data type: "${node2.value}".
Only valid data types are: ${BARE_VALUE_DATA_TYPES.map((x) => `"${x}"`).join(", ")}.
`
                );
                let dataType = node2.value;
                let copy = structuredClone(fn);
                let sentinelValue = "\xB6";
                walk(copy.nodes, (node3) => {
                  if (node3.kind === "word" && node3.value === dataType) {
                    return WalkAction.ReplaceSkip({ kind: "word", value: sentinelValue });
                  }
                });
                let underline = "^".repeat(toCss2([node2]).length);
                let offset = toCss2([copy]).indexOf(sentinelValue);
                let output = [
                  "```css",
                  toCss2([fn]),
                  " ".repeat(offset) + underline,
                  "```"
                ].join("\n");
                console.warn(output);
              }
            }
          });
          child.value = toCss2(declarationValueAst);
        });
        designSystem.utilities.functional(name.slice(0, -2), (candidate) => {
          let atRule2 = cloneAstNode(node);
          let value2 = candidate.value;
          let modifier = candidate.modifier;
          let usedValueFn = false;
          let resolvedValueFn = false;
          let usedModifierFn = false;
          let resolvedModifierFn = false;
          let resolvedDeclarations = /* @__PURE__ */ new Map();
          let resolvedRatioValue = false;
          walk([atRule2], (node2, ctx) => {
            let parent = ctx.parent;
            if (parent?.kind !== "rule" && parent?.kind !== "at-rule") return;
            if (node2.kind !== "declaration") return;
            if (!node2.value) return;
            let shouldRemoveDeclaration = false;
            let valueAst = parse3(node2.value);
            walk(valueAst, (fnNode) => {
              if (fnNode.kind !== "function") return;
              if (fnNode.value === "--value") {
                usedValueFn = true;
                let resolved = resolveValueFunction(value2, fnNode, designSystem);
                if (resolved) {
                  resolvedValueFn = true;
                  if (resolved.ratio) {
                    resolvedRatioValue = true;
                  } else {
                    resolvedDeclarations.set(node2, parent);
                  }
                  return WalkAction.ReplaceSkip(resolved.nodes);
                }
                shouldRemoveDeclaration = true;
                return WalkAction.Stop;
              } else if (fnNode.value === "--modifier") {
                usedModifierFn = true;
                let resolved = resolveValueFunction(modifier, fnNode, designSystem);
                if (resolved) {
                  resolvedModifierFn = true;
                  return WalkAction.ReplaceSkip(resolved.nodes);
                }
                shouldRemoveDeclaration = true;
                return WalkAction.Stop;
              }
            });
            if (shouldRemoveDeclaration) {
              return WalkAction.ReplaceSkip([]);
            }
            node2.value = toCss2(valueAst);
          });
          if (!usedValueFn || !resolvedValueFn) return null;
          if (usedModifierFn && !resolvedModifierFn && modifier !== null) return null;
          if (resolvedRatioValue && resolvedModifierFn) return null;
          if (modifier && !resolvedRatioValue && !resolvedModifierFn) return null;
          if (resolvedRatioValue) {
            for (let [declaration, parent] of resolvedDeclarations) {
              let idx = parent.nodes.indexOf(declaration);
              if (idx !== -1) parent.nodes.splice(idx, 1);
            }
          }
          return atRule2.nodes;
        });
        designSystem.utilities.suggest(name.slice(0, -2), () => {
          let values = [];
          let modifiers = [];
          for (let [target, { literals, usedSpacingNumber, usedSpacingInteger, themeKeys }] of [
            [values, storage["--value"]],
            [modifiers, storage["--modifier"]]
          ]) {
            for (let value2 of literals) {
              target.push(value2);
            }
            if (usedSpacingNumber) {
              target.push(...DEFAULT_SPACING_SUGGESTIONS);
            } else if (usedSpacingInteger) {
              for (let value2 of DEFAULT_SPACING_SUGGESTIONS) {
                if (isPositiveInteger(value2)) {
                  target.push(value2);
                }
              }
            }
            for (let value2 of designSystem.theme.keysInNamespaces(themeKeys)) {
              target.push(
                value2.replace(LEGACY_NUMERIC_KEY, (_, a, b) => {
                  return `${a}.${b}`;
                })
              );
            }
          }
          return [{ values, modifiers }];
        });
      };
    }
    if (isValidStaticUtilityName(name)) {
      return (designSystem) => {
        designSystem.utilities.static(name, () => node.nodes.map(cloneAstNode));
      };
    }
    return null;
  }
  function resolveValueFunction(value2, fn, designSystem) {
    if (value2 === null) {
      for (let arg of fn.nodes) {
        if (arg.kind === "function" && arg.value === "--default") {
          return { nodes: arg.nodes };
        }
      }
      return;
    }
    for (let arg of fn.nodes) {
      if (value2.kind === "named" && arg.kind === "word" && // Should be wreapped in quotes
      (arg.value[0] === "'" || arg.value[0] === '"') && arg.value[arg.value.length - 1] === arg.value[0] && // Values should match
      arg.value.slice(1, -1) === value2.value) {
        return { nodes: parse3(value2.value) };
      } else if (value2.kind === "named" && arg.kind === "word" && arg.value[0] === "-" && arg.value[1] === "-") {
        let themeKey = arg.value;
        if (themeKey.endsWith("-*")) {
          themeKey = themeKey.slice(0, -2);
          let resolved = designSystem.theme.resolve(value2.value, [themeKey]);
          if (resolved) return { nodes: parse3(resolved) };
        } else {
          let nestedKeys = themeKey.split("-*");
          if (nestedKeys.length <= 1) continue;
          let themeKeys = [nestedKeys.shift()];
          let resolved = designSystem.theme.resolveWith(value2.value, themeKeys, nestedKeys);
          if (resolved) {
            let [, options = {}] = resolved;
            {
              let resolved2 = options[nestedKeys.pop()];
              if (resolved2) return { nodes: parse3(resolved2) };
            }
          }
        }
      } else if (value2.kind === "named" && arg.kind === "word") {
        if (!BARE_VALUE_DATA_TYPES.includes(arg.value)) {
          continue;
        }
        let resolved = arg.value === "ratio" && "fraction" in value2 ? value2.fraction : value2.value;
        if (!resolved) continue;
        let type = inferDataType(resolved, [arg.value]);
        if (type === null) continue;
        if (type === "ratio") {
          let [lhs, rhs] = segment(resolved, "/").map(Number);
          if (!isPositiveInteger(lhs) || !isPositiveInteger(rhs)) continue;
        } else if (type === "number" && !isValidSpacingMultiplier(resolved)) {
          continue;
        } else if (type === "percentage" && !isPositiveInteger(resolved.slice(0, -1))) {
          continue;
        }
        if (type === "ratio") {
          let [lhs, rhs] = segment(resolved, "/");
          return { nodes: parse3(`${lhs.trim()} / ${rhs.trim()}`), ratio: true };
        }
        return { nodes: parse3(resolved), ratio: false };
      } else if (value2.kind === "arbitrary" && arg.kind === "word" && arg.value[0] === "[" && arg.value[arg.value.length - 1] === "]") {
        let dataType = arg.value.slice(1, -1);
        if (dataType === "*") {
          return { nodes: parse3(value2.value) };
        }
        if ("dataType" in value2 && value2.dataType && value2.dataType !== dataType) {
          continue;
        }
        if ("dataType" in value2 && value2.dataType) {
          return { nodes: parse3(value2.value) };
        }
        let type = inferDataType(value2.value, [dataType]);
        if (type !== null) {
          return { nodes: parse3(value2.value) };
        }
      }
    }
  }
  function alphaReplacedShadowProperties(property2, value2, alpha2, varInjector, prefix = "") {
    let requiresFallback = false;
    let replacedValue = replaceShadowColors(value2, (color) => {
      if (alpha2 == null) {
        return varInjector(color);
      }
      if (color.startsWith("current")) {
        return varInjector(withAlpha(color, alpha2));
      }
      if (color.startsWith("var(") || alpha2.startsWith("var(")) {
        requiresFallback = true;
      }
      return varInjector(replaceAlpha(color, alpha2));
    });
    function applyPrefix(x) {
      if (!prefix) return x;
      return segment(x, ",").map((value3) => prefix.trim() + " " + value3.trim()).join(", ");
    }
    if (requiresFallback) {
      return [
        decl(property2, applyPrefix(replaceShadowColors(value2, varInjector))),
        rule("@supports (color: lab(from red l a b))", [decl(property2, applyPrefix(replacedValue))])
      ];
    } else {
      return [decl(property2, applyPrefix(replacedValue))];
    }
  }
  function alphaReplacedDropShadowProperties(property2, value2, alpha2, varInjector, prefix = "") {
    let requiresFallback = false;
    let replacedValue = segment(value2, ",").map(
      (value3) => replaceShadowColors(value3, (color) => {
        if (alpha2 == null) {
          return varInjector(color);
        }
        if (color.startsWith("current")) {
          return varInjector(withAlpha(color, alpha2));
        }
        if (color.startsWith("var(") || alpha2.startsWith("var(")) {
          requiresFallback = true;
        }
        return varInjector(replaceAlpha(color, alpha2));
      })
    ).map((value3) => `drop-shadow(${value3})`).join(" ");
    if (requiresFallback) {
      return [
        decl(
          property2,
          prefix + segment(value2, ",").map((value3) => `drop-shadow(${replaceShadowColors(value3, varInjector)})`).join(" ")
        ),
        rule("@supports (color: lab(from red l a b))", [decl(property2, prefix + replacedValue)])
      ];
    } else {
      return [decl(property2, prefix + replacedValue)];
    }
  }
  var UTILITY_ROOT = /^-?[a-z][a-zA-Z0-9_-]*/;
  var PERCENT2 = 37;
  var SLASH3 = 47;
  var DOT2 = 46;
  var LOWER_A3 = 97;
  var LOWER_Z3 = 122;
  var UPPER_A2 = 65;
  var UPPER_Z2 = 90;
  var ZERO2 = 48;
  var NINE2 = 57;
  var UNDERSCORE = 95;
  var DASH3 = 45;
  function isValidStaticUtilityName(name) {
    let match = UTILITY_ROOT.exec(name);
    if (match === null) return false;
    let root = match[0];
    let value2 = name.slice(root.length);
    if (value2.length === 0 && root.endsWith("-")) {
      return false;
    }
    if (value2.length === 0) {
      return true;
    }
    let seenSlash = false;
    for (let i = 0; i < value2.length; i++) {
      let charCode = value2.charCodeAt(i);
      switch (charCode) {
        case PERCENT2: {
          if (i !== value2.length - 1) return false;
          let previousChar = value2[i - 1] || root[root.length - 1] || "";
          let previousCharCode = previousChar.charCodeAt(0);
          if (previousCharCode < ZERO2 || previousCharCode > NINE2) return false;
          break;
        }
        case SLASH3: {
          if (i === value2.length - 1) return false;
          if (seenSlash) return false;
          seenSlash = true;
          break;
        }
        case DOT2: {
          let previousChar = value2[i - 1] || root[root.length - 1] || "";
          let previousCharCode = previousChar.charCodeAt(0);
          if (previousCharCode < ZERO2 || previousCharCode > NINE2) return false;
          let nextChar = value2[i + 1] || "";
          let nextCharCode = nextChar.charCodeAt(0);
          if (nextCharCode < ZERO2 || nextCharCode > NINE2) return false;
          break;
        }
        // Allowed special characters
        case UNDERSCORE:
        case DASH3: {
          continue;
        }
        default: {
          if (charCode >= LOWER_A3 && charCode <= LOWER_Z3 || // Allow a-z
          charCode >= UPPER_A2 && charCode <= UPPER_Z2 || // Allow A-Z
          charCode >= ZERO2 && charCode <= NINE2) {
            continue;
          }
          return false;
        }
      }
    }
    return true;
  }
  function isValidFunctionalUtilityName(name) {
    if (!name.endsWith("-*")) return false;
    name = name.slice(0, -2);
    let match = UTILITY_ROOT.exec(name);
    if (match === null) return false;
    let root = match[0];
    let value2 = name.slice(root.length);
    if (value2.length === 0) {
      return true;
    }
    return false;
  }

  // ../tailwindcss/packages/tailwindcss/src/css-functions.ts
  var CSS_FUNCTIONS = {
    "--alpha": alpha,
    "--spacing": spacing,
    "--theme": theme,
    theme: legacyTheme
  };
  function alpha(_designSystem, _source, value2, ...rest) {
    let [color, alpha2] = segment(value2, "/").map((v) => v.trim());
    if (!color || !alpha2) {
      throw new Error(
        `The --alpha(\u2026) function requires a color and an alpha value, e.g.: \`--alpha(${color || "var(--my-color)"} / ${alpha2 || "50%"})\``
      );
    }
    if (rest.length > 0) {
      throw new Error(
        `The --alpha(\u2026) function only accepts one argument, e.g.: \`--alpha(${color || "var(--my-color)"} / ${alpha2 || "50%"})\``
      );
    }
    return withAlpha(color, alpha2);
  }
  function spacing(designSystem, _source, value2, ...rest) {
    if (!value2) {
      throw new Error(`The --spacing(\u2026) function requires an argument, but received none.`);
    }
    if (rest.length > 0) {
      throw new Error(
        `The --spacing(\u2026) function only accepts a single argument, but received ${rest.length + 1}.`
      );
    }
    let multiplier = designSystem.theme.resolve(null, ["--spacing"]);
    if (!multiplier) {
      throw new Error(
        "The --spacing(\u2026) function requires that the `--spacing` theme variable exists, but it was not found."
      );
    }
    let valueDimension = dimensions.get(value2);
    if (valueDimension) {
      if (valueDimension[0] === 0) return "0px";
      if (valueDimension[0] === 1) return multiplier;
    }
    return `calc(${multiplier} * ${value2})`;
  }
  function theme(designSystem, source, path, ...fallback) {
    if (!path.startsWith("--")) {
      throw new Error(`The --theme(\u2026) function can only be used with CSS variables from your theme.`);
    }
    let inline = false;
    if (path.endsWith(" inline")) {
      inline = true;
      path = path.slice(0, -7);
    }
    if (source.kind === "at-rule") {
      inline = true;
    }
    let resolvedValue = designSystem.resolveThemeValue(path, inline);
    if (!resolvedValue) {
      if (fallback.length > 0) return fallback.join(", ");
      throw new Error(
        `Could not resolve value for theme function: \`theme(${path})\`. Consider checking if the variable name is correct or provide a fallback value to silence this error.`
      );
    }
    if (fallback.length === 0) {
      return resolvedValue;
    }
    let joinedFallback = fallback.join(", ");
    if (joinedFallback === "initial") return resolvedValue;
    if (resolvedValue === "initial") return joinedFallback;
    if (resolvedValue.startsWith("var(") || resolvedValue.startsWith("theme(") || resolvedValue.startsWith("--theme(")) {
      let valueAst = parse3(resolvedValue);
      injectFallbackForInitialFallback(valueAst, joinedFallback);
      return toCss2(valueAst);
    }
    return resolvedValue;
  }
  function legacyTheme(designSystem, _source, path, ...fallback) {
    path = eventuallyUnquote(path);
    let resolvedValue = designSystem.resolveThemeValue(path);
    if (!resolvedValue && fallback.length > 0) {
      return fallback.join(", ");
    }
    if (!resolvedValue) {
      throw new Error(
        `Could not resolve value for theme function: \`theme(${path})\`. Consider checking if the path is correct or provide a fallback value to silence this error.`
      );
    }
    return resolvedValue;
  }
  var THEME_FUNCTION_INVOCATION = new RegExp(
    Object.keys(CSS_FUNCTIONS).map((x) => `${x}\\(`).join("|")
  );
  function substituteFunctions(ast, designSystem) {
    let features = 0 /* None */;
    walk(ast, (node) => {
      if (node.kind === "declaration" && node.value && THEME_FUNCTION_INVOCATION.test(node.value)) {
        features |= 8 /* ThemeFunction */;
        node.value = substituteFunctionsInValue(node.value, node, designSystem);
        return;
      }
      if (node.kind === "at-rule") {
        if ((node.name === "@media" || node.name === "@custom-media" || node.name === "@container" || node.name === "@supports") && THEME_FUNCTION_INVOCATION.test(node.params)) {
          features |= 8 /* ThemeFunction */;
          node.params = substituteFunctionsInValue(node.params, node, designSystem);
        }
      }
    });
    return features;
  }
  function substituteFunctionsInValue(value2, source, designSystem) {
    let ast = parse3(value2);
    walk(ast, (node) => {
      if (node.kind === "function" && node.value in CSS_FUNCTIONS) {
        let args = segment(toCss2(node.nodes).trim(), ",").map((x) => x.trim());
        let result = CSS_FUNCTIONS[node.value](
          designSystem,
          source,
          ...args
        );
        return WalkAction.Replace(parse3(result));
      }
    });
    return toCss2(ast);
  }
  function eventuallyUnquote(value2) {
    if (value2[0] !== "'" && value2[0] !== '"') return value2;
    let unquoted = "";
    let quoteChar = value2[0];
    for (let i = 1; i < value2.length - 1; i++) {
      let currentChar = value2[i];
      let nextChar = value2[i + 1];
      if (currentChar === "\\" && (nextChar === quoteChar || nextChar === "\\")) {
        unquoted += nextChar;
        i++;
      } else {
        unquoted += currentChar;
      }
    }
    return unquoted;
  }
  function injectFallbackForInitialFallback(ast, fallback) {
    walk(ast, (node) => {
      if (node.kind !== "function") return;
      if (node.value !== "var" && node.value !== "theme" && node.value !== "--theme") return;
      if (node.nodes.length === 1) {
        node.nodes.push({
          kind: "word",
          value: `, ${fallback}`
        });
      } else {
        let lastNode = node.nodes[node.nodes.length - 1];
        if (lastNode.kind === "word" && lastNode.value === "initial") {
          lastNode.value = fallback;
        }
      }
    });
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/compare.ts
  var ZERO3 = 48;
  var NINE3 = 57;
  function compare(a, z) {
    let aLen = a.length;
    let zLen = z.length;
    let minLen = aLen < zLen ? aLen : zLen;
    for (let i = 0; i < minLen; i++) {
      let aCode = a.charCodeAt(i);
      let zCode = z.charCodeAt(i);
      if (aCode >= ZERO3 && aCode <= NINE3 && zCode >= ZERO3 && zCode <= NINE3) {
        let aStart = i;
        let aEnd = i + 1;
        let zStart = i;
        let zEnd = i + 1;
        aCode = a.charCodeAt(aEnd);
        while (aCode >= ZERO3 && aCode <= NINE3) aCode = a.charCodeAt(++aEnd);
        zCode = z.charCodeAt(zEnd);
        while (zCode >= ZERO3 && zCode <= NINE3) zCode = z.charCodeAt(++zEnd);
        let aNumber = a.slice(aStart, aEnd);
        let zNumber = z.slice(zStart, zEnd);
        let diff = Number(aNumber) - Number(zNumber);
        if (diff) return diff;
        if (aNumber < zNumber) return -1;
        if (aNumber > zNumber) return 1;
        continue;
      }
      if (aCode === zCode) continue;
      return aCode - zCode;
    }
    return a.length - z.length;
  }

  // ../tailwindcss/packages/tailwindcss/src/attribute-selector-parser.ts
  var TAB4 = 9;
  var LINE_BREAK3 = 10;
  var CARRIAGE_RETURN2 = 13;
  var SPACE5 = 32;
  var DOUBLE_QUOTE6 = 34;
  var DOLLAR = 36;
  var SINGLE_QUOTE6 = 39;
  var ASTERISK3 = 42;
  var EQUALS2 = 61;
  var UPPER_I = 73;
  var UPPER_S = 83;
  var BACKSLASH6 = 92;
  var CARET = 94;
  var LOWER_I = 105;
  var LOWER_S = 115;
  var PIPE2 = 124;
  var TILDE2 = 126;
  var LOWER_A4 = 97;
  var LOWER_Z4 = 122;
  var UPPER_A3 = 65;
  var UPPER_Z3 = 90;
  var ZERO4 = 48;
  var NINE4 = 57;
  var DASH4 = 45;
  var UNDERSCORE2 = 95;
  var NON_ASCII = 128;
  function parse4(input) {
    if (input[0] !== "[" || input[input.length - 1] !== "]") {
      return null;
    }
    let i = 1;
    let start = i;
    let end = input.length - 1;
    while (isAsciiWhitespace(input.charCodeAt(i))) i++;
    {
      start = i;
      for (; i < end; i++) {
        let currentChar2 = input.charCodeAt(i);
        if (currentChar2 === BACKSLASH6) {
          i++;
          continue;
        }
        if (currentChar2 >= UPPER_A3 && currentChar2 <= UPPER_Z3) continue;
        if (currentChar2 >= LOWER_A4 && currentChar2 <= LOWER_Z4) continue;
        if (currentChar2 >= ZERO4 && currentChar2 <= NINE4) continue;
        if (currentChar2 === DASH4 || currentChar2 === UNDERSCORE2) continue;
        if (currentChar2 >= NON_ASCII) continue;
        break;
      }
      if (start === i) {
        return null;
      }
    }
    let attribute = input.slice(start, i);
    while (isAsciiWhitespace(input.charCodeAt(i))) i++;
    if (i === end) {
      return {
        attribute,
        operator: null,
        quote: null,
        value: null,
        sensitivity: null
      };
    }
    let operator = null;
    let currentChar = input.charCodeAt(i);
    if (currentChar === EQUALS2) {
      operator = "=";
      i++;
    } else if ((currentChar === TILDE2 || currentChar === PIPE2 || currentChar === CARET || currentChar === DOLLAR || currentChar === ASTERISK3) && input.charCodeAt(i + 1) === EQUALS2) {
      operator = input[i] + "=";
      i += 2;
    } else {
      return null;
    }
    while (isAsciiWhitespace(input.charCodeAt(i))) i++;
    if (i === end) {
      return null;
    }
    let value2 = "";
    let quote = null;
    currentChar = input.charCodeAt(i);
    if (currentChar === SINGLE_QUOTE6 || currentChar === DOUBLE_QUOTE6) {
      quote = input[i];
      i++;
      start = i;
      for (let j = i; j < end; j++) {
        let current = input.charCodeAt(j);
        if (current === currentChar) {
          i = j + 1;
        } else if (current === BACKSLASH6) {
          j++;
        }
      }
      value2 = input.slice(start, i - 1);
    } else {
      start = i;
      while (i < end && !isAsciiWhitespace(input.charCodeAt(i))) i++;
      value2 = input.slice(start, i);
    }
    while (isAsciiWhitespace(input.charCodeAt(i))) i++;
    if (i === end) {
      return {
        attribute,
        operator,
        quote,
        value: value2,
        sensitivity: null
      };
    }
    let sensitivity = null;
    {
      switch (input.charCodeAt(i)) {
        case LOWER_I:
        case UPPER_I: {
          sensitivity = "i";
          i++;
          break;
        }
        case LOWER_S:
        case UPPER_S: {
          sensitivity = "s";
          i++;
          break;
        }
        default:
          return null;
      }
    }
    while (isAsciiWhitespace(input.charCodeAt(i))) i++;
    if (i !== end) {
      return null;
    }
    return {
      attribute,
      operator,
      quote,
      value: value2,
      sensitivity
    };
  }
  function isAsciiWhitespace(code) {
    switch (code) {
      case SPACE5:
      case TAB4:
      case LINE_BREAK3:
      case CARRIAGE_RETURN2:
        return true;
      default:
        return false;
    }
  }

  // ../tailwindcss/packages/tailwindcss/src/canonicalize-calc-expressions.ts
  function canonicalizeCalcExpressionsAst(ast) {
    let canonicalized = false;
    walk(ast, {
      exit(valueNode) {
        if (valueNode.kind !== "function") return;
        if (valueNode.value !== "calc" && valueNode.value !== "") return;
        if (valueNode.nodes.length !== 5) return;
        if (valueNode.nodes[2].kind !== "word") return;
        if (valueNode.nodes[2].value !== "*" && valueNode.nodes[2].value !== "+") return;
        let lhs = valueNode.nodes[0];
        let rhs = valueNode.nodes[4];
        if (shouldSwap(lhs, rhs)) {
          canonicalized = true;
          let replacement = {
            kind: "function",
            value: valueNode.value,
            nodes: [
              rhs,
              // Now lhs
              valueNode.nodes[1],
              // Separator
              valueNode.nodes[2],
              // Operator
              valueNode.nodes[3],
              // Separator
              lhs
              // Now rhs
            ]
          };
          return WalkAction.ReplaceSkip(replacement);
        }
      }
    });
    return [canonicalized, ast];
  }
  function shouldSwap(lhs, rhs) {
    let lhsDimension = lhs.kind === "word" ? dimensions.get(lhs.value) : null;
    let rhsDimension = rhs.kind === "word" ? dimensions.get(rhs.value) : null;
    if (lhsDimension !== null && rhsDimension === null) return true;
    if (lhsDimension === null && rhsDimension !== null) return false;
    if (lhsDimension !== null && rhsDimension !== null) {
      let [lhsValue, lhsUnit] = lhsDimension;
      let [rhsValue, rhsUnit] = rhsDimension;
      if (lhsUnit === null && rhsUnit !== null) return true;
      if (lhsUnit !== null && rhsUnit === null) return false;
      if (lhsValue !== rhsValue) {
        return lhsValue - rhsValue > 0;
      }
      if (lhsUnit !== rhsUnit) {
        return (lhsUnit ?? "").localeCompare(rhsUnit ?? "") > 0;
      }
    }
    return toCss2([lhs]).localeCompare(toCss2([rhs])) > 0;
  }

  // ../tailwindcss/packages/tailwindcss/src/compat/apply-config-to-theme.ts
  function resolveThemeValue(value2, subValue = null) {
    if (Array.isArray(value2) && value2.length === 2 && typeof value2[1] === "object" && typeof value2[1] !== null) {
      return subValue ? value2[1][subValue] ?? null : value2[0];
    } else if (Array.isArray(value2) && subValue === null) {
      return value2.join(", ");
    } else if (typeof value2 === "string" && subValue === null) {
      return value2;
    }
    return null;
  }
  function applyConfigToTheme(designSystem, { theme: theme2 }, replacedThemeKeys) {
    for (let replacedThemeKey of replacedThemeKeys) {
      let name = keyPathToCssProperty([replacedThemeKey]);
      if (!name) continue;
      designSystem.theme.clearNamespace(`--${name}`, 4 /* DEFAULT */);
    }
    for (let [path, value2] of themeableValues(theme2)) {
      if (typeof value2 !== "string" && typeof value2 !== "number") {
        continue;
      }
      if (typeof value2 === "string") {
        value2 = value2.replace(/<alpha-value>/g, "1");
      }
      if (path[0] === "opacity" && (typeof value2 === "number" || typeof value2 === "string")) {
        let numValue = typeof value2 === "string" ? parseFloat(value2) : value2;
        if (numValue >= 0 && numValue <= 1) {
          value2 = numValue * 100 + "%";
        }
      }
      let name = keyPathToCssProperty(path);
      if (!name) continue;
      designSystem.theme.add(
        `--${name}`,
        "" + value2,
        1 /* INLINE */ | 2 /* REFERENCE */ | 4 /* DEFAULT */
      );
    }
    if (Object.hasOwn(theme2, "fontFamily")) {
      let options = 1 /* INLINE */ | 4 /* DEFAULT */;
      {
        let fontFamily = resolveThemeValue(theme2.fontFamily.sans);
        if (fontFamily && designSystem.theme.hasDefault("--font-sans")) {
          designSystem.theme.add("--default-font-family", fontFamily, options);
          designSystem.theme.add(
            "--default-font-feature-settings",
            resolveThemeValue(theme2.fontFamily.sans, "fontFeatureSettings") ?? "normal",
            options
          );
          designSystem.theme.add(
            "--default-font-variation-settings",
            resolveThemeValue(theme2.fontFamily.sans, "fontVariationSettings") ?? "normal",
            options
          );
        }
      }
      {
        let fontFamily = resolveThemeValue(theme2.fontFamily.mono);
        if (fontFamily && designSystem.theme.hasDefault("--font-mono")) {
          designSystem.theme.add("--default-mono-font-family", fontFamily, options);
          designSystem.theme.add(
            "--default-mono-font-feature-settings",
            resolveThemeValue(theme2.fontFamily.mono, "fontFeatureSettings") ?? "normal",
            options
          );
          designSystem.theme.add(
            "--default-mono-font-variation-settings",
            resolveThemeValue(theme2.fontFamily.mono, "fontVariationSettings") ?? "normal",
            options
          );
        }
      }
    }
    return theme2;
  }
  function themeableValues(config) {
    let toAdd = [];
    walk2(config, [], (value2, path) => {
      if (isValidThemePrimitive(value2)) {
        toAdd.push([path, value2]);
        return 1 /* Skip */;
      }
      if (isValidThemeTuple(value2)) {
        toAdd.push([path, value2[0]]);
        for (let key of Reflect.ownKeys(value2[1])) {
          toAdd.push([[...path, `-${key}`], value2[1][key]]);
        }
        return 1 /* Skip */;
      }
      if (Array.isArray(value2) && value2.every((v) => typeof v === "string")) {
        if (path[0] === "fontSize") {
          toAdd.push([path, value2[0]]);
          if (value2.length >= 2) {
            toAdd.push([[...path, "-line-height"], value2[1]]);
          }
        } else {
          toAdd.push([path, value2.join(", ")]);
        }
        return 1 /* Skip */;
      }
    });
    return toAdd;
  }
  var SPECIAL_DEFAULT_KEYS = {
    borderWidth: "border-width",
    outlineWidth: "outline-width",
    ringColor: "ring-color",
    ringWidth: "ring-width",
    transitionDuration: "transition-duration",
    transitionTimingFunction: "transition-timing-function"
  };
  var OLD_TO_NEW_NAMESPACE = {
    animation: "animate",
    aspectRatio: "aspect",
    borderRadius: "radius",
    boxShadow: "shadow",
    colors: "color",
    containers: "container",
    fontFamily: "font",
    fontSize: "text",
    letterSpacing: "tracking",
    lineHeight: "leading",
    maxWidth: "container",
    screens: "breakpoint",
    transitionTimingFunction: "ease"
  };
  var IS_VALID_KEY = /^[a-zA-Z0-9-_%/.]+$/;
  function keyPathToCssProperty(path) {
    let specialDefault = SPECIAL_DEFAULT_KEYS[path[0]];
    if (specialDefault && path[1] === "DEFAULT") return `default-${specialDefault}`;
    if (path[0] === "container") return null;
    for (let part of path) {
      if (!IS_VALID_KEY.test(part)) return null;
    }
    let ns = OLD_TO_NEW_NAMESPACE[path[0]];
    if (ns) {
      path = path.slice();
      path[0] = ns;
    }
    return path.map((path2, idx, all) => path2 === "1" && idx !== all.length - 1 ? "" : path2).map((part, idx) => {
      part = part.replaceAll(".", "_");
      let shouldConvert = (
        // The first "namespace" part should be converted to kebab-case
        // This converts things like backgroundColor to `background-color`
        idx === 0 || // Any tuple nested key should be converted to kebab-case
        // These are identified with a leading `-`
        // e.g. `fontSize.xs.1.lineHeight` -> `font-size-xs--line-height`
        part.startsWith("-") || // `lineHeight` is a bit of a special case in which it does not
        // always begin with a leading `-` even when as a nested tuple key
        part === "lineHeight"
      );
      if (shouldConvert) {
        part = part.replace(/([a-z])([A-Z])/g, (_, a, b) => `${a}-${b.toLowerCase()}`);
      }
      return part;
    }).filter((part, index) => part !== "DEFAULT" || index !== path.length - 1).join("-");
  }
  function isValidThemePrimitive(value2) {
    return typeof value2 === "number" || typeof value2 === "string";
  }
  function isValidThemeTuple(value2) {
    if (!Array.isArray(value2)) return false;
    if (value2.length !== 2) return false;
    if (typeof value2[0] !== "string" && typeof value2[0] !== "number") return false;
    if (value2[1] === void 0 || value2[1] === null) return false;
    if (typeof value2[1] !== "object") return false;
    for (let key of Reflect.ownKeys(value2[1])) {
      if (typeof key !== "string") return false;
      if (typeof value2[1][key] !== "string" && typeof value2[1][key] !== "number") return false;
    }
    return true;
  }
  function walk2(obj, path = [], callback) {
    for (let key of Reflect.ownKeys(obj)) {
      let value2 = obj[key];
      if (value2 === void 0 || value2 === null) {
        continue;
      }
      let keyPath = [...path, key];
      let result = callback(value2, keyPath) ?? 0 /* Continue */;
      if (result === 1 /* Skip */) continue;
      if (result === 2 /* Stop */) return 2 /* Stop */;
      if (!Array.isArray(value2) && typeof value2 !== "object") continue;
      if (walk2(value2, keyPath, callback) === 2 /* Stop */) {
        return 2 /* Stop */;
      }
    }
  }

  // ../tailwindcss/packages/tailwindcss/src/constant-fold-declaration.ts
  function constantFoldDeclaration(input, rem = null, normalizeUnit = true) {
    let [folded, valueAst] = constantFoldDeclarationAst(parse3(input), rem, normalizeUnit);
    return folded ? toCss2(valueAst) : input;
  }
  function constantFoldDeclarationAst(ast, rem = null, normalizeUnit = true) {
    let folded = false;
    walk(ast, {
      exit(valueNode, ctx) {
        if (valueNode.kind === "word" && valueNode.value !== "0") {
          let canonical = canonicalizeDimension(valueNode.value, rem, normalizeUnit);
          if (canonical === null) return;
          if (canonical === valueNode.value) return;
          if (canonical === "0") {
            if (ctx.parent?.kind === "function") {
              let withUnit = canonicalizeDimension(valueNode.value, rem, false);
              if (withUnit === null) return;
              folded = true;
              return WalkAction.ReplaceSkip(word(withUnit));
            }
          }
          folded = true;
          return WalkAction.ReplaceSkip(word(canonical));
        } else if (valueNode.kind === "function" && (valueNode.value === "calc" || valueNode.value === "")) {
          if (valueNode.nodes.length !== 5) return;
          if (valueNode.nodes[2].kind !== "word") return;
          let lhsNode = valueNode.nodes[0];
          let operator = valueNode.nodes[2].value;
          let rhsNode = valueNode.nodes[4];
          let lhs = lhsNode.kind === "word" ? dimensions.get(lhsNode.value) : null;
          let rhs = rhsNode.kind === "word" ? dimensions.get(rhsNode.value) : null;
          if (operator === "*" && (lhs?.[0] === 0 && lhs?.[1] === null || // 0 * something
          rhs?.[0] === 0 && rhs?.[1] === null)) {
            folded = true;
            return WalkAction.ReplaceSkip(word("0"));
          }
          if (operator === "*" && lhs?.[0] === 0 && lhs?.[1] !== null && rhs?.[1] === null) {
            folded = true;
            if (ctx.parent?.kind === "function") {
              return WalkAction.ReplaceSkip(word(`0${lhs[1]}`));
            } else {
              return WalkAction.ReplaceSkip(word("0"));
            }
          }
          if (operator === "*" && rhs?.[0] === 0 && rhs?.[1] !== null && lhs?.[1] === null) {
            folded = true;
            if (ctx.parent?.kind === "function") {
              return WalkAction.ReplaceSkip(word(`0${rhs[1]}`));
            } else {
              return WalkAction.ReplaceSkip(word("0"));
            }
          }
          if (operator === "*") {
            if (lhs?.[0] === 1 && lhs?.[1] === null) {
              folded = true;
              return WalkAction.ReplaceSkip(rhsNode);
            }
            if (rhs?.[0] === 1 && rhs?.[1] === null) {
              folded = true;
              return WalkAction.ReplaceSkip(lhsNode);
            }
          }
          if (operator === "*" || operator === "+") {
            let constant = lhs ?? rhs;
            let nestedNode = lhs === null ? lhsNode : rhs === null ? rhsNode : null;
            if (constant !== null && nestedNode !== null && nestedNode.kind === "function" && (nestedNode.value === "calc" || nestedNode.value === "") && nestedNode.nodes.length === 5 && nestedNode.nodes[2].kind === "word" && nestedNode.nodes[2].value === operator) {
              let nestedLhsNode = nestedNode.nodes[0];
              let nestedRhsNode = nestedNode.nodes[4];
              let nestedLhs = nestedLhsNode.kind === "word" ? dimensions.get(nestedLhsNode.value) : null;
              let nestedRhs = nestedRhsNode.kind === "word" ? dimensions.get(nestedRhsNode.value) : null;
              let known = nestedLhs ?? nestedRhs;
              let unknown = nestedLhs === null ? nestedLhsNode : nestedRhs === null ? nestedRhsNode : null;
              if (known !== null && unknown !== null) {
                if (operator === "*" && !(constant[1] === null && known[1] === null || // Both can be unitless
                constant[1] === null && known[1] !== null || // One of them can be unitless, but the other can't
                constant[1] !== null && known[1] === null)) {
                  return;
                }
                if (operator === "+" && !(constant[1] === known[1])) {
                  return;
                }
                let combined;
                switch (operator) {
                  case "*": {
                    combined = `${constant[0] * known[0]}${constant[1] ?? known[1] ?? ""}`;
                    break;
                  }
                  case "+": {
                    combined = `${constant[0] + known[0]}${constant[1] ?? known[1] ?? ""}`;
                    break;
                  }
                  default:
                    return;
                }
                folded = true;
                if (operator === "*" && combined === "1") {
                  return WalkAction.ReplaceSkip(unknown);
                }
                let replacement = {
                  kind: "function",
                  value: valueNode.value,
                  nodes: [
                    word(combined),
                    valueNode.nodes[1],
                    valueNode.nodes[2],
                    valueNode.nodes[3],
                    unknown
                  ]
                };
                return WalkAction.ReplaceSkip(replacement);
              }
            }
          }
          if (lhs === null || rhs === null) {
            return;
          }
          switch (operator) {
            case "*": {
              if (lhs[1] === rhs[1] || // Same Units, e.g.: `1rem * 2rem`, `8 * 6`
              lhs[1] === null && rhs[1] !== null || // Unitless * Unit, e.g.: `2 * 1rem`
              lhs[1] !== null && rhs[1] === null) {
                folded = true;
                return WalkAction.ReplaceSkip(
                  word(`${lhs[0] * rhs[0]}${lhs[1] ?? rhs[1] ?? ""}`)
                );
              }
              break;
            }
            case "+": {
              if (lhs[1] === rhs[1]) {
                folded = true;
                return WalkAction.ReplaceSkip(word(`${lhs[0] + rhs[0]}${lhs[1] ?? ""}`));
              }
              break;
            }
            case "-": {
              if (lhs[1] === rhs[1]) {
                folded = true;
                return WalkAction.ReplaceSkip(word(`${lhs[0] - rhs[0]}${lhs[1] ?? ""}`));
              }
              break;
            }
            case "/": {
              if (rhs[0] !== 0 && // Don't divide by zero
              (lhs[1] === null && rhs[1] === null || // Unitless / Unitless, e.g.: `8 / 2`
              lhs[1] !== null && rhs[1] === null)) {
                let computed = lhs[0] / rhs[0];
                if (Math.round(computed * 100) / 100 !== computed) {
                  break;
                }
                folded = true;
                return WalkAction.ReplaceSkip(word(`${computed}${lhs[1] ?? ""}`));
              }
              break;
            }
          }
        }
      }
    });
    return [folded, ast];
  }
  function canonicalizeDimension(input, rem = null, normalizeUnit = true) {
    let dimension = dimensions.get(input);
    if (dimension === null) return null;
    let [value2, unit] = dimension;
    if (unit === null) return `${value2}`;
    if (value2 === 0 && isLength(input)) {
      if (normalizeUnit) return "0";
      else return `0${unit}`;
    }
    if (!normalizeUnit) return `${input}`;
    switch (unit.toLowerCase()) {
      // <length> to px, https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Values_and_units#lengths
      case "in":
        return `${value2 * 96}px`;
      // 1in  = 96.000px
      case "cm":
        return `${value2 * 96 / 2.54}px`;
      // 1cm  = 37.795px
      case "mm":
        return `${value2 * 96 / 2.54 / 10}px`;
      // 1mm  =  3.779px
      case "q":
        return `${value2 * 96 / 2.54 / 10 / 4}px`;
      //  1q  =  0.945px
      case "pc":
        return `${value2 * 96 / 6}px`;
      // 1pc  = 16.000px
      case "pt":
        return `${value2 * 96 / 72}px`;
      // 1pt  =  1.333px
      case "rem":
        return rem !== null ? `${value2 * rem}px` : null;
      // 1rem = 16.000px (Assuming root font-size is 16px)
      // <angle> to deg, https://developer.mozilla.org/en-US/docs/Web/CSS/angle
      case "grad":
        return `${value2 * 0.9}deg`;
      // 1grad =   0.900deg
      case "rad":
        return `${value2 * 180 / Math.PI}deg`;
      //  1rad =  57.296deg
      case "turn":
        return `${value2 * 360}deg`;
      // 1turn = 360.000deg
      // <time> to s, https://developer.mozilla.org/en-US/docs/Web/CSS/time
      case "ms":
        return `${value2 / 1e3}s`;
      // 1ms = 0.001s
      // <frequency> to hz, https://developer.mozilla.org/en-US/docs/Web/CSS/frequency
      case "khz":
        return `${value2 * 1e3}hz`;
      // 1kHz = 1000Hz
      default:
        return `${value2}${unit}`;
    }
  }

  // ../tailwindcss/packages/tailwindcss/src/expand-declaration.ts
  function createPrefixedQuad(prefix, t = "top", r = "right", b = "bottom", l = "left") {
    return createBareQuad(`${prefix}-${t}`, `${prefix}-${r}`, `${prefix}-${b}`, `${prefix}-${l}`);
  }
  function createBareQuad(t = "top", r = "right", b = "bottom", l = "left") {
    return {
      1: [[t, 0], [r, 0], [b, 0], [l, 0]],
      2: [[t, 0], [r, 1], [b, 0], [l, 1]],
      3: [[t, 0], [r, 1], [b, 2], [l, 1]],
      4: [[t, 0], [r, 1], [b, 2], [l, 3]]
    };
  }
  function createPair(lhs, rhs) {
    return {
      1: [[lhs, 0], [rhs, 0]],
      2: [[lhs, 0], [rhs, 1]]
    };
  }
  var VARIADIC_EXPANSION_MAP = {
    inset: createBareQuad(),
    margin: createPrefixedQuad("margin"),
    padding: createPrefixedQuad("padding"),
    "scroll-margin": createPrefixedQuad("scroll-margin"),
    "scroll-padding": createPrefixedQuad("scroll-padding"),
    "border-width": createPrefixedQuad(
      "border",
      "top-width",
      "right-width",
      "bottom-width",
      "left-width"
    ),
    "border-style": createPrefixedQuad(
      "border",
      "top-style",
      "right-style",
      "bottom-style",
      "left-style"
    ),
    "border-color": createPrefixedQuad(
      "border",
      "top-color",
      "right-color",
      "bottom-color",
      "left-color"
    ),
    gap: createPair("row-gap", "column-gap"),
    overflow: createPair("overflow-x", "overflow-y"),
    "overscroll-behavior": createPair("overscroll-behavior-x", "overscroll-behavior-y")
  };
  var VARIADIC_LOGICAL_EXPANSION_MAP = {
    "inset-block": createPair("top", "bottom"),
    "inset-inline": createPair("left", "right"),
    "margin-block": createPair("margin-top", "margin-bottom"),
    "margin-inline": createPair("margin-left", "margin-right"),
    "padding-block": createPair("padding-top", "padding-bottom"),
    "padding-inline": createPair("padding-left", "padding-right"),
    "scroll-margin-block": createPair("scroll-margin-top", "scroll-margin-bottom"),
    "scroll-margin-inline": createPair("scroll-margin-left", "scroll-margin-right"),
    "scroll-padding-block": createPair("scroll-padding-top", "scroll-padding-bottom"),
    "scroll-padding-inline": createPair("scroll-padding-left", "scroll-padding-right")
  };
  var LOGICAL_EXPANSION_MAP = {
    "border-block": ["border-bottom", "border-top"],
    "border-block-color": ["border-bottom-color", "border-top-color"],
    "border-block-style": ["border-bottom-style", "border-top-style"],
    "border-block-width": ["border-bottom-width", "border-top-width"],
    "border-inline": ["border-left", "border-right"],
    "border-inline-color": ["border-left-color", "border-right-color"],
    "border-inline-style": ["border-left-style", "border-right-style"],
    "border-inline-width": ["border-left-width", "border-right-width"]
  };
  function expandDeclaration(node, options) {
    if (options & 2 /* LogicalToPhysical */) {
      if (node.property in VARIADIC_LOGICAL_EXPANSION_MAP) {
        let args = segment(node.value, " ");
        return VARIADIC_LOGICAL_EXPANSION_MAP[node.property][args.length]?.map(([prop, index]) => {
          return decl(prop, args[index], node.important);
        });
      }
      if (node.property in LOGICAL_EXPANSION_MAP) {
        return LOGICAL_EXPANSION_MAP[node.property]?.map((prop) => {
          return decl(prop, node.value, node.important);
        });
      }
    }
    if (node.property in VARIADIC_EXPANSION_MAP) {
      let args = segment(node.value, " ");
      return VARIADIC_EXPANSION_MAP[node.property][args.length]?.map(([prop, index]) => {
        return decl(prop, args[index], node.important);
      });
    }
    return null;
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/replace-object.ts
  function replaceObject(target, source) {
    for (let key in target) delete target[key];
    return Object.assign(target, source);
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/to-key-path.ts
  function toKeyPath(path) {
    let keypath = [];
    for (let part of segment(path, ".")) {
      if (!part.includes("[")) {
        keypath.push(part);
        continue;
      }
      let currentIndex = 0;
      while (true) {
        let bracketL = part.indexOf("[", currentIndex);
        let bracketR = part.indexOf("]", bracketL);
        if (bracketL === -1 || bracketR === -1) {
          break;
        }
        if (bracketL > currentIndex) {
          keypath.push(part.slice(currentIndex, bracketL));
        }
        keypath.push(part.slice(bracketL + 1, bracketR));
        currentIndex = bracketR + 1;
      }
      if (currentIndex <= part.length - 1) {
        keypath.push(part.slice(currentIndex));
      }
    }
    return keypath;
  }

  // ../tailwindcss/packages/tailwindcss/src/canonicalize-candidates.ts
  function prepareDesignSystemStorage(baseDesignSystem, options) {
    let designSystem = baseDesignSystem;
    designSystem.storage[SIGNATURE_OPTIONS_KEY] ??= createSignatureOptionsCache();
    designSystem.storage[INTERNAL_OPTIONS_KEY] ??= createInternalOptionsCache(designSystem);
    designSystem.storage[CANONICALIZE_CANDIDATE_KEY] ??= createCanonicalizeCandidateCache();
    designSystem.storage[CANONICALIZE_VARIANT_KEY] ??= createCanonicalizeVariantCache();
    designSystem.storage[CANONICALIZE_UTILITY_KEY] ??= createCanonicalizeUtilityCache();
    designSystem.storage[CONVERTER_KEY] ??= createConverterCache(designSystem);
    designSystem.storage[SPACING_KEY] ??= createSpacingCache(designSystem, options);
    designSystem.storage[UTILITY_SIGNATURE_KEY] ??= createUtilitySignatureCache(designSystem);
    designSystem.storage[STATIC_UTILITIES_KEY] ??= createStaticUtilitiesCache();
    designSystem.storage[UTILITY_PROPERTIES_KEY] ??= createUtilityPropertiesCache(designSystem);
    designSystem.storage[PRE_COMPUTED_UTILITIES_KEY] ??= createPreComputedUtilitiesCache(designSystem);
    designSystem.storage[VARIANT_SIGNATURE_KEY] ??= createVariantSignatureCache(designSystem);
    designSystem.storage[PRE_COMPUTED_VARIANTS_KEY] ??= createPreComputedVariantsCache(designSystem);
    designSystem.storage[COMPARE_CANDIDATES_KEY] ??= createSignatureComparison(designSystem);
    return designSystem;
  }
  var SIGNATURE_OPTIONS_KEY = /* @__PURE__ */ Symbol();
  function createSignatureOptionsCache() {
    return new DefaultMap((rem) => {
      return new DefaultMap((features) => {
        return { rem, features };
      });
    });
  }
  var COMPARE_CANDIDATES_KEY = /* @__PURE__ */ Symbol();
  function createSignatureComparison(designSystem) {
    return new DefaultMap((options) => {
      let signatures = designSystem.storage[UTILITY_SIGNATURE_KEY].get(options);
      return function hasSameSignature(a, b) {
        let aCandidateString = typeof a === "string" ? a : designSystem.printCandidate(a);
        let aSignature = signatures.get(aCandidateString);
        if (typeof aSignature !== "string") return false;
        let bCandidateString = typeof b === "string" ? b : designSystem.printCandidate(b);
        let bSignature = signatures.get(bCandidateString);
        if (typeof bSignature !== "string") return false;
        return aSignature === bSignature;
      };
    });
  }
  function createSignatureOptions(baseDesignSystem, options) {
    let features = 0 /* None */;
    if (options?.collapse) features |= 1 /* ExpandProperties */;
    if (options?.logicalToPhysical) features |= 2 /* LogicalToPhysical */;
    let designSystem = prepareDesignSystemStorage(baseDesignSystem, options);
    return designSystem.storage[SIGNATURE_OPTIONS_KEY].get(options?.rem ?? null).get(features);
  }
  var INTERNAL_OPTIONS_KEY = /* @__PURE__ */ Symbol();
  function createInternalOptionsCache(designSystem) {
    return new DefaultMap((signatureOptions) => {
      return new DefaultMap((features) => {
        return { features, designSystem, signatureOptions };
      });
    });
  }
  function createCanonicalizeOptions(baseDesignSystem, signatureOptions, options) {
    let features = 0 /* None */;
    if (options?.collapse) features |= 1 /* CollapseUtilities */;
    let designSystem = prepareDesignSystemStorage(baseDesignSystem);
    return designSystem.storage[INTERNAL_OPTIONS_KEY].get(signatureOptions).get(features);
  }
  function canonicalizeCandidates(baseDesignSystem, candidates, options) {
    let signatureOptions = createSignatureOptions(baseDesignSystem, options);
    let canonicalizeOptions = createCanonicalizeOptions(baseDesignSystem, signatureOptions, options);
    let designSystem = prepareDesignSystemStorage(baseDesignSystem);
    let result = /* @__PURE__ */ new Set();
    let cache = designSystem.storage[CANONICALIZE_CANDIDATE_KEY].get(canonicalizeOptions);
    for (let candidate of candidates) {
      result.add(cache.get(candidate));
    }
    return result.size <= 1 || !(canonicalizeOptions.features & 1 /* CollapseUtilities */) ? Array.from(result) : collapseCandidates(canonicalizeOptions, Array.from(result));
  }
  function collapseCandidates(options, candidates) {
    let designSystem = options.designSystem;
    let groups = new DefaultMap((_before) => {
      return new DefaultMap((_after) => {
        return /* @__PURE__ */ new Set();
      });
    });
    let prefix = options.designSystem.theme.prefix ? `${options.designSystem.theme.prefix}:` : "";
    for (let candidate of candidates) {
      let variants = segment(candidate, ":");
      let utility = variants.pop();
      let important = utility.endsWith("!");
      if (important) {
        utility = utility.slice(0, -1);
      }
      let before = variants.length > 0 ? `${variants.join(":")}:` : "";
      let after = important ? "!" : "";
      groups.get(before).get(after).add(`${prefix}${utility}`);
    }
    let result = /* @__PURE__ */ new Set();
    for (let [before, group] of groups.entries()) {
      for (let [after, candidates2] of group.entries()) {
        for (let candidate of collapseGroup(Array.from(candidates2))) {
          if (prefix && candidate.startsWith(prefix)) {
            candidate = candidate.slice(prefix.length);
          }
          result.add(`${before}${candidate}${after}`);
        }
      }
    }
    return Array.from(result);
    function collapseGroup(candidates2) {
      let signatureOptions = options.signatureOptions;
      let computeUtilitiesPropertiesLookup = designSystem.storage[UTILITY_PROPERTIES_KEY].get(signatureOptions);
      let staticUtilities = designSystem.storage[STATIC_UTILITIES_KEY].get(signatureOptions);
      let candidatePropertiesValues = candidates2.map(
        (candidate) => computeUtilitiesPropertiesLookup.get(candidate)
      );
      if (candidatePropertiesValues.some((x) => x.has("line-height"))) {
        let fontSizeNames = designSystem.theme.keysInNamespaces(["--text"]);
        if (fontSizeNames.length > 0) {
          let interestingLineHeights = /* @__PURE__ */ new Set();
          let seenLineHeights = /* @__PURE__ */ new Set();
          for (let pairs of candidatePropertiesValues) {
            if (!pairs.has("line-height")) continue;
            for (let lineHeight of pairs.get("line-height")) {
              if (seenLineHeights.has(lineHeight)) continue;
              seenLineHeights.add(lineHeight);
              let bareValue = designSystem.storage[SPACING_KEY]?.get(lineHeight) ?? null;
              if (bareValue !== null) {
                if (isValidSpacingMultiplier(bareValue)) {
                  interestingLineHeights.add(bareValue);
                  for (let name of fontSizeNames) {
                    computeUtilitiesPropertiesLookup.get(`text-${name}/${bareValue}`);
                  }
                } else {
                  interestingLineHeights.add(lineHeight);
                  for (let name of fontSizeNames) {
                    computeUtilitiesPropertiesLookup.get(`text-${name}/[${lineHeight}]`);
                  }
                }
              }
            }
          }
          let seenFontSizes = /* @__PURE__ */ new Set();
          for (let pairs of candidatePropertiesValues) {
            if (!pairs.has("font-size")) continue;
            for (let fontSize of pairs.get("font-size")) {
              if (seenFontSizes.has(fontSize)) continue;
              seenFontSizes.add(fontSize);
              for (let lineHeight of interestingLineHeights) {
                if (isValidSpacingMultiplier(lineHeight)) {
                  computeUtilitiesPropertiesLookup.get(`text-[${fontSize}]/${lineHeight}`);
                } else {
                  computeUtilitiesPropertiesLookup.get(`text-[${fontSize}]/[${lineHeight}]`);
                }
              }
            }
          }
        }
      }
      let dynamicUtilities = new DefaultMap((candidate) => {
        let result3 = new DefaultMap(
          (_property) => new DefaultMap((_value) => /* @__PURE__ */ new Set())
        );
        let relevantProperties = new Set(computeUtilitiesPropertiesLookup.get(candidate).keys());
        if (relevantProperties.size === 0) return result3;
        for (let parsedCandidate of parseCandidate2(designSystem, candidate)) {
          if (parsedCandidate.kind !== "functional" || parsedCandidate.value === null) {
            continue;
          }
          for (let root of designSystem.utilities.keys("functional")) {
            if (root === parsedCandidate.root) continue;
            let replacement = printUnprefixedCandidate(designSystem, {
              ...cloneCandidate(parsedCandidate),
              root
            });
            let propertyValues = computeUtilitiesPropertiesLookup.get(replacement);
            for (let [property2, values] of propertyValues) {
              if (!relevantProperties.has(property2)) continue;
              for (let value2 of values) {
                result3.get(property2).get(value2).add(replacement);
              }
            }
          }
          return result3;
        }
        return result3;
      });
      let otherUtilities = candidatePropertiesValues.map((propertyValues, idx) => {
        let result3 = null;
        for (let property2 of propertyValues.keys()) {
          let otherUtilities2 = /* @__PURE__ */ new Set();
          for (let group of staticUtilities.get(property2).values()) {
            for (let candidate of group) {
              otherUtilities2.add(candidate);
            }
          }
          for (let value2 of propertyValues.get(property2)) {
            for (let candidate of dynamicUtilities.get(candidates2[idx]).get(property2).get(value2)) {
              otherUtilities2.add(candidate);
            }
          }
          if (result3 === null) result3 = otherUtilities2;
          else result3 = intersection(result3, otherUtilities2);
          if (result3.size === 0) return result3;
        }
        return result3 ?? /* @__PURE__ */ new Set();
      });
      let linked = new DefaultMap((key) => /* @__PURE__ */ new Set([key]));
      for (let i = 0; i < otherUtilities.length; i++) {
        let current = otherUtilities[i];
        for (let j = i + 1; j < otherUtilities.length; j++) {
          let other = otherUtilities[j];
          for (let property2 of current) {
            if (other.has(property2)) {
              linked.get(i).add(j);
              linked.get(j).add(i);
              break;
            }
          }
        }
      }
      if (linked.size === 0) return candidates2;
      let uniqueCombinations = new DefaultMap((key) => key.split(",").map(Number));
      for (let group of linked.values()) {
        let sorted = Array.from(group).sort((a, b) => a - b);
        uniqueCombinations.get(sorted.join(","));
      }
      let result2 = new Set(candidates2);
      let drop = /* @__PURE__ */ new Set();
      for (let idxs of uniqueCombinations.values()) {
        for (let combo of combinations(idxs)) {
          if (combo.some((idx) => drop.has(candidates2[idx]))) continue;
          let potentialReplacements = combo.flatMap((idx) => otherUtilities[idx]).reduce(intersection);
          let collapsedSignature = designSystem.storage[UTILITY_SIGNATURE_KEY].get(
            signatureOptions
          ).get(
            combo.map((idx) => candidates2[idx]).sort((a, z) => a.localeCompare(z)).join(" ")
          );
          for (let replacement of potentialReplacements) {
            let signature = designSystem.storage[UTILITY_SIGNATURE_KEY].get(signatureOptions).get(replacement);
            if (signature !== collapsedSignature) continue;
            result2.add(replacement);
            for (let item of combo) {
              if (candidates2[item] !== replacement) {
                drop.add(candidates2[item]);
              }
            }
            break;
          }
        }
      }
      for (let item of drop) {
        result2.delete(item);
      }
      return Array.from(result2);
    }
  }
  var CANONICALIZE_CANDIDATE_KEY = /* @__PURE__ */ Symbol();
  function createCanonicalizeCandidateCache() {
    return new DefaultMap((options) => {
      let ds = options.designSystem;
      let prefix = ds.theme.prefix ? `${ds.theme.prefix}:` : "";
      let variantCache = ds.storage[CANONICALIZE_VARIANT_KEY].get(options);
      let utilityCache = ds.storage[CANONICALIZE_UTILITY_KEY].get(options);
      return new DefaultMap((rawCandidate, self) => {
        for (let candidate of ds.parseCandidate(rawCandidate)) {
          let variants = candidate.variants.slice().reverse().flatMap((variant) => variantCache.get(variant));
          let important = candidate.important;
          if (important || variants.length > 0) {
            let canonicalizedUtility = self.get(
              ds.printCandidate({ ...candidate, variants: [], important: false })
            );
            let result2 = canonicalizedUtility;
            if (ds.theme.prefix !== null && variants.length > 0) {
              result2 = result2.slice(prefix.length);
            }
            if (variants.length > 0) {
              result2 = `${variants.map((v) => ds.printVariant(v)).join(":")}:${result2}`;
            }
            if (important) {
              result2 += "!";
            }
            if (ds.theme.prefix !== null && variants.length > 0) {
              result2 = `${prefix}${result2}`;
            }
            return result2;
          }
          let result = utilityCache.get(rawCandidate);
          if (result !== rawCandidate) {
            return result;
          }
        }
        return rawCandidate;
      });
    });
  }
  var VARIANT_CANONICALIZATIONS = [
    themeToVarVariant,
    arbitraryValueToBareValueVariant,
    modernizeArbitraryValuesVariant,
    arbitraryVariants
  ];
  var CANONICALIZE_VARIANT_KEY = /* @__PURE__ */ Symbol();
  function createCanonicalizeVariantCache() {
    return new DefaultMap((options) => {
      return new DefaultMap((variant) => {
        let replacement = [variant];
        for (let fn of VARIANT_CANONICALIZATIONS) {
          for (let current of replacement.splice(0)) {
            let result = fn(cloneVariant(current), options);
            if (Array.isArray(result)) {
              replacement.push(...result);
              continue;
            } else {
              replacement.push(result);
            }
          }
        }
        return replacement;
      });
    });
  }
  var UTILITY_CANONICALIZATIONS = [
    bgGradientToLinear,
    themeToVarUtility,
    calcToSpacingFunction,
    optimizeArbitraryValueExpressions,
    arbitraryUtilities,
    bareValueUtilities,
    deprecatedUtilities,
    dropUnnecessaryDataTypes,
    arbitraryValueToBareValueUtility,
    optimizeModifier
  ];
  var CANONICALIZE_UTILITY_KEY = /* @__PURE__ */ Symbol();
  function createCanonicalizeUtilityCache() {
    return new DefaultMap((options) => {
      let designSystem = options.designSystem;
      return new DefaultMap((rawCandidate) => {
        for (let readonlyCandidate of designSystem.parseCandidate(rawCandidate)) {
          let replacement = cloneCandidate(readonlyCandidate);
          for (let fn of UTILITY_CANONICALIZATIONS) {
            replacement = fn(replacement, options);
          }
          let canonicalizedCandidate = designSystem.printCandidate(replacement);
          if (rawCandidate !== canonicalizedCandidate) {
            return canonicalizedCandidate;
          }
        }
        return rawCandidate;
      });
    });
  }
  var DIRECTIONS = ["t", "tr", "r", "br", "b", "bl", "l", "tl"];
  function bgGradientToLinear(candidate) {
    if (candidate.kind === "static" && candidate.root.startsWith("bg-gradient-to-")) {
      let direction = candidate.root.slice(15);
      if (!DIRECTIONS.includes(direction)) {
        return candidate;
      }
      candidate.root = `bg-linear-to-${direction}`;
      return candidate;
    }
    return candidate;
  }
  function themeToVarUtility(candidate, options) {
    let convert = options.designSystem.storage[CONVERTER_KEY];
    if (candidate.kind === "arbitrary") {
      let [newValue, modifier] = convert(
        candidate.value,
        candidate.modifier === null ? 1 /* MigrateModifier */ : 0 /* All */
      );
      if (newValue !== candidate.value) {
        candidate.value = newValue;
        if (modifier !== null) {
          candidate.modifier = modifier;
        }
      }
    } else if (candidate.kind === "functional" && candidate.value?.kind === "arbitrary") {
      let [newValue, modifier] = convert(
        candidate.value.value,
        candidate.modifier === null ? 1 /* MigrateModifier */ : 0 /* All */
      );
      if (newValue !== candidate.value.value) {
        candidate.value.value = newValue;
        if (modifier !== null) {
          candidate.modifier = modifier;
        }
      }
    }
    return candidate;
  }
  function themeToVarVariant(variant, options) {
    let convert = options.designSystem.storage[CONVERTER_KEY];
    let iterator = walkVariants(variant);
    for (let [variant2] of iterator) {
      if (variant2.kind === "arbitrary") {
        let [newValue] = convert(variant2.selector, 2 /* MigrateThemeOnly */);
        if (newValue !== variant2.selector) {
          variant2.selector = newValue;
        }
      } else if (variant2.kind === "functional" && variant2.value?.kind === "arbitrary") {
        let [newValue] = convert(variant2.value.value, 2 /* MigrateThemeOnly */);
        if (newValue !== variant2.value.value) {
          variant2.value.value = newValue;
        }
      }
    }
    return variant;
  }
  function calcToSpacingFunction(candidate, options) {
    if (candidate.kind === "arbitrary") {
      candidate.value = spacingCalcToSpacingFunction(candidate.value, options.designSystem);
    } else if (candidate.kind === "functional" && candidate.value?.kind === "arbitrary") {
      candidate.value.value = spacingCalcToSpacingFunction(
        candidate.value.value,
        options.designSystem
      );
    }
    return candidate;
  }
  function spacingCalcToSpacingFunction(input, designSystem) {
    let spacingVariable = designSystem.theme.prefix ? `--${designSystem.theme.prefix}-spacing` : "--spacing";
    let ast = parse3(input);
    walk(ast, (node) => {
      if (node.kind !== "function" || node.value !== "calc") return;
      if (node.nodes.length !== 5) return;
      if (node.nodes[2].kind !== "word" || node.nodes[2].value !== "*") {
        return;
      }
      if (node.nodes[0].kind !== "function" || node.nodes[0].value !== "var" || node.nodes[0].nodes.length !== 1 || node.nodes[0].nodes[0].kind !== "word" || node.nodes[0].nodes[0].value !== spacingVariable) {
        return;
      }
      return WalkAction.Replace(
        parse3(
          `--spacing(${toCss2([node.nodes[4]])})`
        )
      );
    });
    return toCss2(ast);
  }
  var CONVERTER_KEY = /* @__PURE__ */ Symbol();
  function createConverterCache(designSystem) {
    return createConverter(designSystem);
    function createConverter(designSystem2) {
      function convert(input, options = 0 /* All */) {
        let ast = parse3(input);
        if (options & 2 /* MigrateThemeOnly */) {
          return [substituteFunctionsInValue2(ast, toTheme), null];
        }
        let themeUsageCount = 0;
        let themeModifierCount = 0;
        walk(ast, (node) => {
          if (node.kind !== "function") return;
          if (node.value !== "theme") return;
          themeUsageCount += 1;
          walk(node.nodes, (child) => {
            if (child.kind === "separator" && child.value.includes(",")) {
              return WalkAction.Stop;
            } else if (child.kind === "word" && child.value === "/") {
              themeModifierCount += 1;
              return WalkAction.Stop;
            }
            return WalkAction.Skip;
          });
        });
        if (themeUsageCount === 0) {
          return [input, null];
        }
        if (themeModifierCount === 0) {
          return [substituteFunctionsInValue2(ast, toVar), null];
        }
        if (themeModifierCount > 1) {
          return [substituteFunctionsInValue2(ast, toTheme), null];
        }
        let modifier = null;
        let result = substituteFunctionsInValue2(ast, (path, fallback) => {
          let parts = segment(path, "/").map((part) => part.trim());
          if (parts.length > 2) return null;
          if (ast.length === 1 && parts.length === 2 && options & 1 /* MigrateModifier */) {
            let [pathPart, modifierPart] = parts;
            if (/^\d+%$/.test(modifierPart)) {
              modifier = { kind: "named", value: modifierPart.slice(0, -1) };
            } else if (/^0?\.\d+$/.test(modifierPart)) {
              let value2 = Number(modifierPart) * 100;
              modifier = {
                kind: Number.isInteger(value2) ? "named" : "arbitrary",
                value: value2.toString()
              };
            } else {
              modifier = { kind: "arbitrary", value: modifierPart };
            }
            path = pathPart;
          }
          return toVar(path, fallback) || toTheme(path, fallback);
        });
        return [result, modifier];
      }
      function pathToVariableName(path, shouldPrefix = true) {
        let variable = `--${keyPathToCssProperty(toKeyPath(path))}`;
        if (!designSystem2.theme.get([variable])) return null;
        if (shouldPrefix && designSystem2.theme.prefix) {
          return `--${designSystem2.theme.prefix}-${variable.slice(2)}`;
        }
        return variable;
      }
      function toVar(path, fallback) {
        let variable = pathToVariableName(path);
        if (variable) return fallback ? `var(${variable}, ${fallback})` : `var(${variable})`;
        let keyPath = toKeyPath(path);
        if (keyPath[0] === "spacing" && designSystem2.theme.get(["--spacing"])) {
          let multiplier = keyPath[1];
          if (!isValidSpacingMultiplier(multiplier)) return null;
          return `--spacing(${multiplier})`;
        }
        return null;
      }
      function toTheme(path, fallback) {
        let parts = segment(path, "/").map((part) => part.trim());
        path = parts.shift();
        let variable = pathToVariableName(path, false);
        if (!variable) return null;
        let modifier = parts.length > 0 ? `/${parts.join("/")}` : "";
        return fallback ? `--theme(${variable}${modifier}, ${fallback})` : `--theme(${variable}${modifier})`;
      }
      return convert;
    }
  }
  function substituteFunctionsInValue2(ast, handle) {
    walk(ast, (node, ctx) => {
      if (node.kind === "function" && node.value === "theme") {
        if (node.nodes.length < 1) return;
        if (node.nodes[0].kind === "separator" && node.nodes[0].value.trim() === "") {
          node.nodes.shift();
        }
        let pathNode = node.nodes[0];
        if (pathNode.kind !== "word") return;
        let path = pathNode.value;
        let skipUntilIndex = 1;
        for (let i = skipUntilIndex; i < node.nodes.length; i++) {
          if (node.nodes[i].value.includes(",")) {
            break;
          }
          path += toCss2([node.nodes[i]]);
          skipUntilIndex = i + 1;
        }
        path = eventuallyUnquote2(path);
        let fallbackValues = node.nodes.slice(skipUntilIndex + 1);
        let replacement = fallbackValues.length > 0 ? handle(path, toCss2(fallbackValues)) : handle(path);
        if (replacement === null) return;
        {
          let idx = ctx.index - 1;
          while (idx !== -1) {
            let previous = ctx.siblings[idx];
            if (previous.kind === "separator" && previous.value.trim() === "") {
              idx -= 1;
              continue;
            }
            if (/^[-+*/]$/.test(previous.value.trim())) {
              replacement = `(${replacement})`;
            }
            break;
          }
        }
        return WalkAction.Replace(parse3(replacement));
      }
    });
    return toCss2(ast);
  }
  function eventuallyUnquote2(value2) {
    if (value2[0] !== "'" && value2[0] !== '"') return value2;
    let unquoted = "";
    let quoteChar = value2[0];
    for (let i = 1; i < value2.length - 1; i++) {
      let currentChar = value2[i];
      let nextChar = value2[i + 1];
      if (currentChar === "\\" && (nextChar === quoteChar || nextChar === "\\")) {
        unquoted += nextChar;
        i++;
      } else {
        unquoted += currentChar;
      }
    }
    return unquoted;
  }
  function* walkVariants(variant) {
    function* inner(variant2, parent = null) {
      yield [variant2, parent];
      if (variant2.kind === "compound") {
        yield* inner(variant2.variant, variant2);
      }
    }
    yield* inner(variant, null);
  }
  function parseCandidate2(designSystem, input) {
    return designSystem.parseCandidate(
      designSystem.theme.prefix && !input.startsWith(`${designSystem.theme.prefix}:`) ? `${designSystem.theme.prefix}:${input}` : input
    );
  }
  function printUnprefixedCandidate(designSystem, candidate) {
    let candidateString = designSystem.printCandidate(candidate);
    return designSystem.theme.prefix && candidateString.startsWith(`${designSystem.theme.prefix}:`) ? candidateString.slice(designSystem.theme.prefix.length + 1) : candidateString;
  }
  var SPACING_KEY = /* @__PURE__ */ Symbol();
  var MAX_BARE_VALUE_IN_PX = 1536;
  var MAX_BARE_VALUE_IN_REM = MAX_BARE_VALUE_IN_PX / 16;
  function isReasonableBareValue(value2, designSystem, rem) {
    let spacingMultiplier = designSystem.resolveThemeValue("--spacing");
    if (spacingMultiplier === void 0) return false;
    let parsed = dimensions.get(constantFoldDeclaration(spacingMultiplier, rem));
    if (parsed === null) return false;
    let [spacingValue, spacingUnit] = parsed;
    let bareValueInPixels = value2 * spacingValue;
    if (spacingUnit === "px") return bareValueInPixels <= MAX_BARE_VALUE_IN_PX;
    if (spacingUnit === "rem") return bareValueInPixels <= MAX_BARE_VALUE_IN_REM;
    return false;
  }
  function createSpacingCache(designSystem, options) {
    let spacingMultiplier = designSystem.resolveThemeValue("--spacing");
    if (spacingMultiplier === void 0) return null;
    spacingMultiplier = constantFoldDeclaration(spacingMultiplier, options?.rem ?? null);
    let parsed = dimensions.get(spacingMultiplier);
    if (!parsed) return null;
    let [value2, unit] = parsed;
    return new DefaultMap((input) => {
      if (value2 === 0) return null;
      let parsed2 = dimensions.get(constantFoldDeclaration(input, options?.rem ?? null));
      if (!parsed2) return null;
      let [myValue, myUnit] = parsed2;
      if (myUnit !== unit) return null;
      return myValue / value2;
    });
  }
  function arbitraryUtilities(candidate, options) {
    if (
      // Arbitrary property
      candidate.kind !== "arbitrary" && // Arbitrary value
      !(candidate.kind === "functional" && candidate.value?.kind === "arbitrary")
    ) {
      return candidate;
    }
    let designSystem = options.designSystem;
    let utilities2 = designSystem.storage[PRE_COMPUTED_UTILITIES_KEY].get(options.signatureOptions);
    let signatures = designSystem.storage[UTILITY_SIGNATURE_KEY].get(options.signatureOptions);
    let hasSameSignature = designSystem.storage[COMPARE_CANDIDATES_KEY].get(options.signatureOptions);
    let targetCandidateString = designSystem.printCandidate(candidate);
    let targetSignature = signatures.get(targetCandidateString);
    if (typeof targetSignature !== "string") return candidate;
    for (let replacementCandidate of tryReplacements(targetSignature, candidate)) {
      if (!hasSameSignature(candidate, replacementCandidate)) {
        continue;
      }
      if (!allVariablesAreUsed(designSystem, candidate, replacementCandidate)) {
        continue;
      }
      return replacementCandidate;
    }
    return candidate;
    function* tryReplacements(targetSignature2, candidate2) {
      let replacements = utilities2.get(targetSignature2);
      if (replacements.length > 1) {
        let maybeReplacement = void 0;
        for (let replacement of replacements) {
          if (replacement[0] === "-") continue;
          if (maybeReplacement) return;
          maybeReplacement = replacement;
        }
        if (maybeReplacement) {
          for (let replacementCandidate of parseCandidate2(designSystem, maybeReplacement)) {
            yield replacementCandidate;
          }
        }
        return;
      }
      if (replacements.length === 0 && candidate2.modifier) {
        let candidateWithoutModifier = { ...candidate2, modifier: null };
        let targetSignatureWithoutModifier = signatures.get(
          designSystem.printCandidate(candidateWithoutModifier)
        );
        if (typeof targetSignatureWithoutModifier === "string") {
          for (let replacementCandidate of tryReplacements(
            targetSignatureWithoutModifier,
            candidateWithoutModifier
          )) {
            yield Object.assign({}, replacementCandidate, { modifier: candidate2.modifier });
          }
        }
      }
      if (replacements.length === 1) {
        for (let replacementCandidate of parseCandidate2(designSystem, replacements[0])) {
          yield replacementCandidate;
        }
      } else if (replacements.length === 0) {
        let value2 = candidate2.kind === "arbitrary" ? candidate2.value : candidate2.value?.value ?? null;
        if (value2 === null) return;
        if (options.signatureOptions.rem !== null && candidate2.kind === "functional" && candidate2.value?.kind === "arbitrary") {
          let bareValue = designSystem.storage[SPACING_KEY]?.get(value2) ?? null;
          if (bareValue !== null) {
            if (isValidSpacingMultiplier(bareValue) && isReasonableBareValue(bareValue, designSystem, options.signatureOptions.rem)) {
              yield Object.assign({}, candidate2, {
                value: { kind: "named", value: bareValue, fraction: null }
              });
            }
          }
        }
        let spacingMultiplier = designSystem.storage[SPACING_KEY]?.get(value2) ?? null;
        let rootPrefix = "";
        if (spacingMultiplier !== null && spacingMultiplier < 0) {
          rootPrefix = "-";
          spacingMultiplier = Math.abs(spacingMultiplier);
        }
        for (let root of Array.from(designSystem.utilities.keys("functional")).sort(
          // Sort negative roots after positive roots so that we can try
          // `mt-*` before `-mt-*`. This is especially useful in situations where
          // `-mt-[0px]` can be translated to `mt-[0px]`.
          (a, z) => Number(a[0] === "-") - Number(z[0] === "-")
        )) {
          if (rootPrefix) root = `${rootPrefix}${root}`;
          for (let replacementCandidate of parseCandidate2(designSystem, `${root}-${value2}`)) {
            yield replacementCandidate;
          }
          if (candidate2.modifier) {
            for (let replacementCandidate of parseCandidate2(
              designSystem,
              `${root}-${value2}${candidate2.modifier}`
            )) {
              yield replacementCandidate;
            }
          }
          if (spacingMultiplier !== null && isValidSpacingMultiplier(spacingMultiplier) && isReasonableBareValue(spacingMultiplier, designSystem, options.signatureOptions.rem)) {
            for (let replacementCandidate of parseCandidate2(
              designSystem,
              `${root}-${spacingMultiplier}`
            )) {
              yield replacementCandidate;
            }
            if (candidate2.modifier) {
              for (let replacementCandidate of parseCandidate2(
                designSystem,
                `${root}-${spacingMultiplier}${printModifier(candidate2.modifier)}`
              )) {
                yield replacementCandidate;
              }
            }
          }
          for (let replacementCandidate of parseCandidate2(designSystem, `${root}-[${value2}]`)) {
            yield replacementCandidate;
          }
          if (candidate2.modifier) {
            for (let replacementCandidate of parseCandidate2(
              designSystem,
              `${root}-[${value2}]${printModifier(candidate2.modifier)}`
            )) {
              yield replacementCandidate;
            }
          }
        }
      }
    }
  }
  function allVariablesAreUsed(designSystem, candidate, replacement) {
    let value2 = null;
    if (candidate.kind === "functional" && candidate.value?.kind === "arbitrary" && candidate.value.value.includes("var(--")) {
      value2 = candidate.value.value;
    } else if (candidate.kind === "arbitrary" && candidate.value.includes("var(--")) {
      value2 = candidate.value;
    }
    if (value2 === null) {
      return true;
    }
    let replacementAsCss = designSystem.candidatesToCss([designSystem.printCandidate(replacement)]).join("\n");
    let isSafeMigration = true;
    walk(parse3(value2), (node) => {
      if (node.kind === "function" && node.value === "var") {
        let variable = node.nodes[0].value;
        let r = new RegExp(`var\\(${variable}[,)]\\s*`, "g");
        if (
          // We need to check if the variable is used in the replacement
          !r.test(replacementAsCss) || // The value cannot be set to a different value in the
          // replacement because that would make it an unsafe migration
          replacementAsCss.includes(`${variable}:`)
        ) {
          isSafeMigration = false;
          return WalkAction.Stop;
        }
      }
    });
    return isSafeMigration;
  }
  function bareValueUtilities(candidate, options) {
    if (candidate.kind !== "functional" || candidate.value?.kind !== "named") {
      return candidate;
    }
    let designSystem = options.designSystem;
    let utilities2 = designSystem.storage[PRE_COMPUTED_UTILITIES_KEY].get(options.signatureOptions);
    let signatures = designSystem.storage[UTILITY_SIGNATURE_KEY].get(options.signatureOptions);
    let hasSameSignature = designSystem.storage[COMPARE_CANDIDATES_KEY].get(options.signatureOptions);
    let targetCandidateString = designSystem.printCandidate(candidate);
    let targetSignature = signatures.get(targetCandidateString);
    if (typeof targetSignature !== "string") return candidate;
    for (let replacementCandidate of tryReplacements(targetSignature, candidate)) {
      if (!hasSameSignature(candidate, replacementCandidate)) {
        continue;
      }
      return replacementCandidate;
    }
    return candidate;
    function* tryReplacements(targetSignature2, candidate2) {
      let replacements = utilities2.get(targetSignature2);
      if (replacements.length > 1) {
        let maybeReplacement = void 0;
        for (let replacement of replacements) {
          if (replacement[0] === "-") continue;
          if (maybeReplacement) return;
          maybeReplacement = replacement;
        }
        if (maybeReplacement) {
          for (let replacementCandidate of parseCandidate2(designSystem, maybeReplacement)) {
            yield replacementCandidate;
          }
        }
        return;
      }
      if (replacements.length === 0 && candidate2.modifier) {
        let candidateWithoutModifier = { ...candidate2, modifier: null };
        let targetSignatureWithoutModifier = signatures.get(
          designSystem.printCandidate(candidateWithoutModifier)
        );
        if (typeof targetSignatureWithoutModifier === "string") {
          for (let replacementCandidate of tryReplacements(
            targetSignatureWithoutModifier,
            candidateWithoutModifier
          )) {
            yield Object.assign({}, replacementCandidate, { modifier: candidate2.modifier });
          }
        }
      }
      if (replacements.length === 1) {
        for (let replacementCandidate of parseCandidate2(designSystem, replacements[0])) {
          yield replacementCandidate;
        }
      }
    }
  }
  var DEPRECATION_MAP = /* @__PURE__ */ new Map([
    ["order-none", "order-0"],
    ["break-words", "wrap-break-word"],
    ["overflow-ellipsis", "text-ellipsis"]
  ]);
  var DEPRECATION_TRANSFORMATION_MAP = /* @__PURE__ */ new Map([
    [/^(-)?start-(.*?)$/, "$1inset-s-$2"],
    [/^(-)?end-(.*?)$/, "$1inset-e-$2"]
  ]);
  function* tryDeprecatedUtilities(candidate) {
    let replacement = DEPRECATION_MAP.get(candidate);
    if (replacement) yield replacement;
    for (let [searchValue, replaceValue] of DEPRECATION_TRANSFORMATION_MAP) {
      let replacement2 = candidate.replace(searchValue, replaceValue);
      if (replacement2 === candidate) continue;
      yield replacement2;
    }
  }
  function deprecatedUtilities(candidate, options) {
    let designSystem = options.designSystem;
    let hasSameSignature = designSystem.storage[COMPARE_CANDIDATES_KEY].get(options.signatureOptions);
    let targetCandidateString = printUnprefixedCandidate(designSystem, candidate);
    for (let replacementString of tryDeprecatedUtilities(targetCandidateString)) {
      if (!hasSameSignature(candidate, replacementString)) {
        continue;
      }
      let [replacement] = parseCandidate2(designSystem, replacementString);
      return replacement;
    }
    return candidate;
  }
  function arbitraryVariants(variant, options) {
    let designSystem = options.designSystem;
    let signatures = designSystem.storage[VARIANT_SIGNATURE_KEY].get(options.signatureOptions.rem);
    let variants = designSystem.storage[PRE_COMPUTED_VARIANTS_KEY].get(options.signatureOptions.rem);
    let iterator = walkVariants(variant);
    for (let [variant2] of iterator) {
      if (variant2.kind === "compound") continue;
      let targetString = designSystem.printVariant(variant2);
      let targetSignature = signatures.get(targetString);
      if (typeof targetSignature !== "string") continue;
      let foundVariants = variants.get(targetSignature);
      if (foundVariants.length === 0) continue;
      if (foundVariants.includes(targetString)) continue;
      let foundVariant = foundVariants[0];
      let parsedVariant = designSystem.parseVariant(foundVariant);
      if (parsedVariant === null) continue;
      replaceObject(variant2, parsedVariant);
    }
    return variant;
  }
  function dropUnnecessaryDataTypes(candidate, options) {
    let designSystem = options.designSystem;
    let signatures = designSystem.storage[UTILITY_SIGNATURE_KEY].get(options.signatureOptions);
    if (candidate.kind === "functional" && candidate.value?.kind === "arbitrary" && candidate.value.dataType !== null) {
      let replacement = designSystem.printCandidate({
        ...candidate,
        value: { ...candidate.value, dataType: null }
      });
      if (signatures.get(designSystem.printCandidate(candidate)) === signatures.get(replacement)) {
        candidate.value.dataType = null;
      }
    }
    return candidate;
  }
  function arbitraryValueToBareValueUtility(candidate, options) {
    if (candidate.kind !== "functional" || candidate.value?.kind !== "arbitrary") {
      return candidate;
    }
    let designSystem = options.designSystem;
    let signatures = designSystem.storage[UTILITY_SIGNATURE_KEY].get(options.signatureOptions);
    let expectedSignature = signatures.get(designSystem.printCandidate(candidate));
    if (expectedSignature === null) return candidate;
    for (let value2 of tryValueReplacements(candidate)) {
      let newSignature = signatures.get(designSystem.printCandidate({ ...candidate, value: value2 }));
      if (newSignature === expectedSignature) {
        candidate.value = value2;
        return candidate;
      }
    }
    return candidate;
  }
  function arbitraryValueToBareValueVariant(variant) {
    let iterator = walkVariants(variant);
    for (let [variant2] of iterator) {
      if (variant2.kind === "functional" && variant2.root === "data" && variant2.value?.kind === "arbitrary" && !variant2.value.value.includes("=")) {
        variant2.value = {
          kind: "named",
          value: variant2.value.value
        };
      } else if (variant2.kind === "functional" && variant2.root === "aria" && variant2.value?.kind === "arbitrary" && (variant2.value.value.endsWith("=true") || variant2.value.value.endsWith('="true"') || variant2.value.value.endsWith("='true'"))) {
        let [key, _value] = segment(variant2.value.value, "=");
        if (
          // aria-[foo~="true"]
          key[key.length - 1] === "~" || // aria-[foo|="true"]
          key[key.length - 1] === "|" || // aria-[foo^="true"]
          key[key.length - 1] === "^" || // aria-[foo$="true"]
          key[key.length - 1] === "$" || // aria-[foo*="true"]
          key[key.length - 1] === "*"
        ) {
          continue;
        }
        variant2.value = {
          kind: "named",
          value: variant2.value.value.slice(0, variant2.value.value.indexOf("="))
        };
      } else if (variant2.kind === "functional" && variant2.root === "supports" && variant2.value?.kind === "arbitrary" && /^[a-z-][a-z0-9-]*$/i.test(variant2.value.value)) {
        variant2.value = {
          kind: "named",
          value: variant2.value.value
        };
      }
    }
    return variant;
  }
  function* tryValueReplacements(candidate, value2 = candidate.value?.value ?? "", seen = /* @__PURE__ */ new Set()) {
    if (seen.has(value2)) return;
    seen.add(value2);
    yield {
      kind: "named",
      value: value2,
      fraction: null
    };
    if (value2.endsWith("%") && isValidSpacingMultiplier(value2.slice(0, -1))) {
      yield {
        kind: "named",
        value: value2.slice(0, -1),
        fraction: null
      };
    }
    if (value2.includes("/")) {
      let [numerator, denominator] = value2.split("/");
      if (isPositiveInteger(numerator) && isPositiveInteger(denominator)) {
        yield {
          kind: "named",
          value: numerator,
          fraction: `${numerator}/${denominator}`
        };
      }
    }
    let allNumbersAndFractions = /* @__PURE__ */ new Set();
    for (let match of value2.matchAll(/(\d+\/\d+)|(\d+\.?\d+)/g)) {
      allNumbersAndFractions.add(match[0].trim());
    }
    let options = Array.from(allNumbersAndFractions).sort((a, z) => {
      return a.length - z.length;
    });
    for (let option of options) {
      yield* tryValueReplacements(candidate, option, seen);
    }
  }
  function isSingleSelector(ast) {
    if (ast.length === 1 && ast[0].kind === "list") return false;
    return true;
  }
  function isAttributeSelector(node) {
    return node.value[0] === "[" && node.value[node.value.length - 1] === "]";
  }
  function modernizeArbitraryValuesVariant(variant, options) {
    let result = [variant];
    let designSystem = options.designSystem;
    let signatures = designSystem.storage[VARIANT_SIGNATURE_KEY].get(options.signatureOptions.rem);
    let iterator = walkVariants(variant);
    for (let [variant2, parent] of iterator) {
      if (variant2.kind === "compound" && (variant2.root === "has" || variant2.root === "not" || variant2.root === "in")) {
        if (variant2.modifier !== null) {
          if ("modifier" in variant2.variant) {
            variant2.variant.modifier = variant2.modifier;
            variant2.modifier = null;
          }
        }
      }
      if (variant2.kind === "arbitrary") {
        if (variant2.relative) continue;
        let ast = parse(variant2.selector);
        if (!isSingleSelector(ast)) continue;
        if (ast.length === 1 && ast[0].kind === "complex") {
          ast = ast[0].nodes;
        }
        if (
          // Only top-level, so `has-[&>*]` is not supported
          parent === null && // [&_>_*]:flex
          //  ^ ^ ^
          ast.length === 3 && ast[0].kind === "selector" && ast[0].value === "&" && ast[1].kind === "combinator" && ast[1].value === ">" && ast[2].kind === "selector" && ast[2].value === "*"
        ) {
          replaceObject(variant2, designSystem.parseVariant("*"));
          continue;
        }
        if (
          // Only top-level, so `has-[&_*]` is not supported
          parent === null && // [&_*]:flex
          //  ^ ^
          ast.length === 3 && ast[0].kind === "selector" && ast[0].value === "&" && ast[1].kind === "combinator" && ast[1].value === " " && ast[2].kind === "selector" && ast[2].value === "*"
        ) {
          replaceObject(variant2, designSystem.parseVariant("**"));
          continue;
        }
        if (
          // Only top-level, so `group-[&:has(…)]` is not covered
          parent === null && // [&:has(…)]:flex
          //  ^ ^^^^^^
          ast.length === 1 && ast[0].kind === "compound" && ast[0].nodes.length === 2 && ast[0].nodes[0].kind === "selector" && ast[0].nodes[0].value === "&" && ast[0].nodes[1].kind === "function" && ast[0].nodes[1].value === ":has" && ast[0].nodes[1].nodes.length === 1 && ast[0].nodes[1].nodes[0].kind === "selector"
        ) {
          replaceObject(
            variant2,
            designSystem.parseVariant(`has-[${toCss(ast[0].nodes[1].nodes, true)}]`)
          );
          continue;
        }
        if (
          // Only top-level, so `in-[&_[data-visible]]` is not supported
          parent === null && // [[data-visible]___&]:flex
          //  ^^^^^^^^^^^^^^ ^ ^
          ast.length === 3 && ast[0].kind === "selector" && ast[1].kind === "combinator" && ast[1].value === " " && ast[2].kind === "selector" && ast[2].value === "&"
        ) {
          ast.pop();
          ast.pop();
          replaceObject(variant2, designSystem.parseVariant(`in-[${toCss(ast, true)}]`));
          continue;
        }
        if (
          // Only top-level, so something like `in-[@media(scripting:none)]`
          // (which is not valid anyway) is not supported
          parent === null && // [@media_not(scripting:none)]:flex
          //  ^^^^^^^^^^^^^^^^^^^^^^^^^^^
          ast[0].kind === "selector" && (ast[0].value === "@media" || ast[0].value === "@supports")
        ) {
          let targetSignature = signatures.get(designSystem.printVariant(variant2));
          let parsed = parse3(toCss(ast, true));
          let containsNot = false;
          walk(parsed, (node) => {
            if (node.kind === "word" && node.value === "not") {
              containsNot = true;
              return WalkAction.Replace([]);
            }
          });
          parsed = parse3(toCss2(parsed));
          walk(parsed, (node) => {
            if (node.kind === "separator" && node.value !== " " && node.value.trim() === "") {
              node.value = " ";
            }
          });
          if (containsNot) {
            let hoistedNot = designSystem.parseVariant(`not-[${toCss2(parsed)}]`);
            if (hoistedNot === null) continue;
            let hoistedNotSignature = signatures.get(designSystem.printVariant(hoistedNot));
            if (targetSignature === hoistedNotSignature) {
              replaceObject(variant2, hoistedNot);
              continue;
            }
          }
        }
        let prefixedVariant = null;
        if (
          // Only top-level, so `has-[&>[data-visible]]` is not supported
          parent === null && // [&_>_[data-visible]]:flex
          //  ^ ^ ^^^^^^^^^^^^^^
          ast.length === 3 && ast[0].kind === "selector" && ast[0].value === "&" && ast[1].kind === "combinator" && ast[1].value === ">" && ast[2].kind === "selector" && (ast[2].value[0] === ":" || isAttributeSelector(ast[2]))
        ) {
          ast = [ast[2]];
          prefixedVariant = designSystem.parseVariant("*");
        }
        if (
          // Only top-level, so `has-[&_[data-visible]]` is not supported
          parent === null && // [&_[data-visible]]:flex
          //  ^ ^^^^^^^^^^^^^^
          ast.length === 3 && ast[0].kind === "selector" && ast[0].value === "&" && ast[1].kind === "combinator" && ast[1].value === " " && ast[2].kind === "selector" && (ast[2].value[0] === ":" || isAttributeSelector(ast[2]))
        ) {
          ast = [ast[2]];
          prefixedVariant = designSystem.parseVariant("**");
        }
        let selectorNodes = ast;
        walk(selectorNodes, {
          enter(node) {
            if (node.kind === "selector" && node.value === "&") {
              return WalkAction.Replace([]);
            }
            if (node.kind === "function") {
              return WalkAction.Skip;
            }
          },
          exit(node) {
            if (node.kind === "compound" && node.nodes.length === 1) {
              return WalkAction.ReplaceSkip(node.nodes);
            }
          }
        });
        if (selectorNodes.length !== 1) continue;
        let target = selectorNodes[0];
        if (target.kind === "function" && target.value === ":is") {
          if (!isSingleSelector(target.nodes) || // [foo][bar] is considered a single selector but has multiple nodes
          target.nodes.length !== 1) {
            continue;
          }
          if (target.nodes[0].kind === "selector" && !isAttributeSelector(target.nodes[0])) continue;
          target = target.nodes[0];
        }
        if (target.kind === "function" && target.value[0] === ":" || target.kind === "selector" && target.value[0] === ":") {
          let targetNode = target;
          let compoundNot = false;
          if (targetNode.kind === "function" && targetNode.value === ":not") {
            compoundNot = true;
            if (targetNode.nodes.length !== 1) continue;
            if (targetNode.nodes[0].kind !== "selector" && targetNode.nodes[0].kind !== "function") {
              continue;
            }
            if (targetNode.nodes[0].value[0] !== ":") continue;
            targetNode = targetNode.nodes[0];
          }
          let newVariant = ((value2) => {
            if (value2 === ":nth-child" && targetNode.kind === "function" && targetNode.nodes.length === 1 && targetNode.nodes[0].kind === "value" && targetNode.nodes[0].value === "odd") {
              if (compoundNot) {
                compoundNot = false;
                return "even";
              }
              return "odd";
            }
            if (value2 === ":nth-child" && targetNode.kind === "function" && targetNode.nodes.length === 1 && targetNode.nodes[0].kind === "value" && targetNode.nodes[0].value === "even") {
              if (compoundNot) {
                compoundNot = false;
                return "odd";
              }
              return "even";
            }
            for (let [selector2, variantName] of [
              [":nth-child", "nth"],
              [":nth-last-child", "nth-last"],
              [":nth-of-type", "nth-of-type"],
              [":nth-last-of-type", "nth-of-last-type"]
            ]) {
              if (value2 === selector2 && targetNode.kind === "function" && targetNode.nodes.length === 1) {
                if (targetNode.nodes.length === 1 && targetNode.nodes[0].kind === "value" && isPositiveInteger(targetNode.nodes[0].value)) {
                  return `${variantName}-${targetNode.nodes[0].value}`;
                }
                return `${variantName}-[${toCss(targetNode.nodes, true)}]`;
              }
            }
            if (compoundNot) {
              let targetSignature = signatures.get(designSystem.printVariant(variant2));
              let replacementSignature = signatures.get(`not-[${value2}]`);
              if (targetSignature === replacementSignature) {
                return `[&${value2}]`;
              }
            }
            return null;
          })(targetNode.value);
          if (newVariant === null) {
            if (prefixedVariant) {
              replaceObject(variant2, {
                kind: "arbitrary",
                selector: target.value,
                relative: false
              });
              return [prefixedVariant, variant2];
            }
            continue;
          }
          if (compoundNot) newVariant = `not-${newVariant}`;
          let parsed = designSystem.parseVariant(newVariant);
          if (parsed === null) continue;
          replaceObject(variant2, parsed);
        } else if (target.kind === "selector" && isAttributeSelector(target)) {
          let attributeSelector = parse4(target.value);
          if (attributeSelector === null) continue;
          if (attributeSelector.attribute.startsWith("data-")) {
            let name = attributeSelector.attribute.slice(5);
            replaceObject(variant2, {
              kind: "functional",
              root: "data",
              modifier: null,
              value: attributeSelector.value === null ? { kind: "named", value: name } : {
                kind: "arbitrary",
                value: `${name}${attributeSelector.operator}${attributeSelector.quote ?? ""}${attributeSelector.value}${attributeSelector.quote ?? ""}${attributeSelector.sensitivity ? ` ${attributeSelector.sensitivity}` : ""}`
              }
            });
          } else if (attributeSelector.attribute.startsWith("aria-")) {
            let name = attributeSelector.attribute.slice(5);
            replaceObject(variant2, {
              kind: "functional",
              root: "aria",
              modifier: null,
              value: attributeSelector.value === null ? { kind: "arbitrary", value: name } : attributeSelector.operator === "=" && attributeSelector.value === "true" && attributeSelector.sensitivity === null ? { kind: "named", value: name } : {
                kind: "arbitrary",
                value: `${attributeSelector.attribute}${attributeSelector.operator}${attributeSelector.quote ?? ""}${attributeSelector.value}${attributeSelector.quote ?? ""}${attributeSelector.sensitivity ? ` ${attributeSelector.sensitivity}` : ""}`
              }
              // aria-[foo~="true"], aria-[foo|="true"], …
            });
          } else {
            replaceObject(variant2, {
              kind: "arbitrary",
              selector: target.value,
              relative: false
            });
          }
        }
        if (prefixedVariant) {
          return [prefixedVariant, variant2];
        }
      }
    }
    return result;
  }
  function optimizeArbitraryValueExpressions(candidate, options) {
    if (candidate.kind !== "functional" || candidate.value?.kind !== "arbitrary") {
      return candidate;
    }
    let designSystem = options.designSystem;
    let hasSameSignature = designSystem.storage[COMPARE_CANDIDATES_KEY].get(options.signatureOptions);
    let valueAst = parse3(candidate.value.value);
    if (valueAst.length === 1 && valueAst[0].kind === "function" && valueAst[0].value === "calc") {
      let [folded, foldedValueAst] = constantFoldDeclarationAst(valueAst, null, false);
      if (folded) {
        let replacement = cloneCandidate(candidate);
        replacement.value.value = toCss2(foldedValueAst);
        if (hasSameSignature(candidate, replacement)) {
          candidate = replacement;
          valueAst = foldedValueAst;
        }
      }
    }
    if (candidate.root[0] === "-") {
      if (valueAst.length === 1 && valueAst[0].kind === "function" && valueAst[0].value === "var") {
        return candidate;
      }
      let expressionAst = parse3(`calc(${candidate.value.value} * -1)`);
      let [folded, foldedExpressionAst] = constantFoldDeclarationAst(expressionAst, null, false);
      if (folded) {
        let replacement = cloneCandidate(candidate);
        replacement.root = replacement.root.slice(1);
        replacement.value.value = toCss2(foldedExpressionAst);
        if (hasSameSignature(candidate, replacement)) {
          candidate = replacement;
          valueAst = foldedExpressionAst;
        }
      }
    }
    if (valueAst.length === 1 && valueAst[0].kind === "function" && valueAst[0].value === "calc") {
      let calcArgs = valueAst[0].nodes;
      if (calcArgs.length === 5 && calcArgs[1].kind === "separator" && calcArgs[1].value === " " && calcArgs[2].kind === "word" && calcArgs[2].value === "*" && calcArgs[3].kind === "separator" && calcArgs[3].value === " ") {
        let arg = calcArgs[4].kind === "word" && calcArgs[4].value === "-1" ? calcArgs[0] : calcArgs[0].kind === "word" && calcArgs[0].value === "-1" ? calcArgs[4] : null;
        if (arg) {
          let replacement = cloneCandidate(candidate);
          replacement.root = `-${candidate.root}`;
          replacement.value.value = toCss2([arg]);
          if (hasSameSignature(candidate, replacement)) {
            candidate = replacement;
          }
        }
      }
    }
    return candidate;
  }
  function optimizeModifier(candidate, options) {
    if (candidate.kind !== "functional" && candidate.kind !== "arbitrary" || candidate.modifier === null) {
      return candidate;
    }
    let designSystem = options.designSystem;
    let signatures = designSystem.storage[UTILITY_SIGNATURE_KEY].get(options.signatureOptions);
    let targetSignature = signatures.get(designSystem.printCandidate(candidate));
    let modifier = candidate.modifier;
    if (targetSignature === signatures.get(designSystem.printCandidate({ ...candidate, modifier: null }))) {
      candidate.modifier = null;
      return candidate;
    }
    {
      let newModifier = {
        kind: "named",
        value: modifier.value.endsWith("%") ? modifier.value.includes(".") ? `${Number(modifier.value.slice(0, -1))}` : modifier.value.slice(0, -1) : modifier.value,
        fraction: null
      };
      if (targetSignature === signatures.get(designSystem.printCandidate({ ...candidate, modifier: newModifier }))) {
        candidate.modifier = newModifier;
        return candidate;
      }
    }
    {
      let newModifier = {
        kind: "named",
        value: `${parseFloat(modifier.value) * 100}`,
        fraction: null
      };
      if (targetSignature === signatures.get(designSystem.printCandidate({ ...candidate, modifier: newModifier }))) {
        candidate.modifier = newModifier;
        return candidate;
      }
    }
    return candidate;
  }
  var UTILITY_SIGNATURE_KEY = /* @__PURE__ */ Symbol();
  function createUtilitySignatureCache(designSystem) {
    return new DefaultMap((options) => {
      return new DefaultMap((utility) => {
        try {
          utility = designSystem.theme.prefix && !utility.startsWith(designSystem.theme.prefix) ? `${designSystem.theme.prefix}:${utility}` : utility;
          let ast = [styleRule(".x", [atRule("@apply", utility)])];
          temporarilyDisableThemeInline(designSystem, () => {
            for (let candidate of designSystem.parseCandidate(utility)) {
              designSystem.compileAstNodes(candidate, 1 /* RespectImportant */);
            }
            substituteAtApply(ast, designSystem);
          });
          canonicalizeAst(designSystem, ast, options);
          let signature = toCss3(ast);
          return signature;
        } catch {
          return /* @__PURE__ */ Symbol();
        }
      });
    });
  }
  var HEX_REGEX = /#(?:[a-f0-9]{8}|[a-f0-9]{6}|[a-f0-9]{4}|[a-f0-9]{3})/gi;
  function canonicalizeAst(designSystem, ast, options) {
    let { rem } = options;
    walk(ast, {
      enter(node, ctx) {
        if (node.kind === "declaration") {
          if (node.value === void 0 || node.property === "--tw-sort") {
            return WalkAction.Replace([]);
          }
          if (node.property.startsWith("--tw-")) {
            if (ctx.siblings.some(
              (sibling) => sibling.kind === "declaration" && node.value === sibling.value && node.important === sibling.important && !sibling.property.startsWith("--tw-")
            )) {
              return WalkAction.Replace([]);
            }
          }
          if (options.features & 1 /* ExpandProperties */) {
            let replacement = expandDeclaration(node, options.features);
            if (replacement) return WalkAction.Replace(replacement);
          }
          if (node.value.includes("var(")) {
            node.value = resolveVariablesInValue(node.value, designSystem);
          }
          let valueAst = parse3(node.value);
          let [folded, foldedValueAst] = constantFoldDeclarationAst(valueAst, rem);
          let [normalized, canonicalizedValueAst] = canonicalizeCalcExpressionsAst(foldedValueAst);
          if (folded || normalized) {
            node.value = toCss2(canonicalizedValueAst);
          }
          node.value = printArbitraryValue(node.value);
        } else if (node.kind === "context" || node.kind === "at-root") {
          return WalkAction.Replace(node.nodes);
        } else if (node.kind === "comment") {
          return WalkAction.Replace([]);
        } else if (node.kind === "at-rule" && node.name === "@property") {
          return WalkAction.Replace([]);
        }
      },
      exit(node) {
        if (node.kind === "rule" || node.kind === "at-rule") {
          if (node.nodes.length > 1) {
            let seen = /* @__PURE__ */ new Set();
            for (let i = node.nodes.length - 1; i >= 0; i--) {
              let child = node.nodes[i];
              if (child.kind !== "declaration") continue;
              if (child.value === void 0) continue;
              if (seen.has(child.property)) {
                node.nodes.splice(i, 1);
              }
              seen.add(child.property);
            }
          }
          node.nodes.sort((a, b) => {
            if (a.kind !== "declaration") return 0;
            if (b.kind !== "declaration") return 0;
            return a.property.localeCompare(b.property);
          });
        } else if (node.kind === "declaration" && node.value) {
          if (node.property[0] === "-" && node.property[1] === "-") return;
          {
            HEX_REGEX.lastIndex = 0;
            node.value = node.value.replace(HEX_REGEX, (color) => color.toLowerCase());
          }
        }
      }
    });
    return ast;
  }
  var CSS_WIDE_KEYWORDS = ["initial", "inherit", "revert", "revert-layer", "revert-rule", "unset"];
  function resolveVariablesInValue(value2, designSystem) {
    let changed = false;
    let valueAst = parse3(value2);
    let seen = /* @__PURE__ */ new Set();
    walk(valueAst, (valueNode) => {
      if (valueNode.kind !== "function") return;
      if (valueNode.value !== "var") return;
      if (valueNode.nodes.length !== 1 && valueNode.nodes.length < 3) {
        return;
      }
      let variable = valueNode.nodes[0].value;
      if (designSystem.theme.prefix && variable.startsWith(`--${designSystem.theme.prefix}-`)) {
        variable = variable.slice(`--${designSystem.theme.prefix}-`.length);
      }
      let variableValue = designSystem.resolveThemeValue(variable);
      if (seen.has(variable)) return;
      seen.add(variable);
      if (variableValue === void 0) return;
      if (CSS_WIDE_KEYWORDS.includes(variableValue.toLowerCase())) return;
      {
        if (valueNode.nodes.length === 1) {
          changed = true;
          valueNode.nodes.push(...parse3(`,${variableValue}`));
        }
      }
      {
        if (valueNode.nodes.length >= 3) {
          let nodeAsString = toCss2(valueNode.nodes);
          let constructedValue = `${valueNode.nodes[0].value},${variableValue}`;
          if (nodeAsString === constructedValue) {
            changed = true;
            return WalkAction.Replace(parse3(variableValue));
          }
        }
      }
    });
    if (changed) return toCss2(valueAst);
    return value2;
  }
  var STATIC_UTILITIES_KEY = /* @__PURE__ */ Symbol();
  function createStaticUtilitiesCache() {
    return new DefaultMap((_optiones) => {
      return new DefaultMap((_property) => {
        return new DefaultMap((_value) => {
          return /* @__PURE__ */ new Set();
        });
      });
    });
  }
  var UTILITY_PROPERTIES_KEY = /* @__PURE__ */ Symbol();
  function createUtilityPropertiesCache(designSystem) {
    return new DefaultMap((options) => {
      return new DefaultMap((className) => {
        let localPropertyValueLookup = new DefaultMap((_property) => /* @__PURE__ */ new Set());
        if (designSystem.theme.prefix && !className.startsWith(designSystem.theme.prefix)) {
          className = `${designSystem.theme.prefix}:${className}`;
        }
        let parsed = designSystem.parseCandidate(className);
        if (parsed.length === 0) return localPropertyValueLookup;
        try {
          let ast = designSystem.compileAstNodes(parsed[0]).map((x) => cloneAstNode(x.node));
          walk(canonicalizeAst(designSystem, ast, options), (node) => {
            if (node.kind === "declaration") {
              localPropertyValueLookup.get(node.property).add(node.value);
              designSystem.storage[STATIC_UTILITIES_KEY].get(options).get(node.property).get(node.value).add(className);
            }
          });
        } catch {
        }
        return localPropertyValueLookup;
      });
    });
  }
  var PRE_COMPUTED_UTILITIES_KEY = /* @__PURE__ */ Symbol();
  function createPreComputedUtilitiesCache(designSystem) {
    return new DefaultMap((options) => {
      let signatures = designSystem.storage[UTILITY_SIGNATURE_KEY].get(options);
      let lookup = new DefaultMap(() => []);
      for (let [className, meta] of designSystem.getClassList()) {
        let signature = signatures.get(className);
        if (typeof signature !== "string") continue;
        if (className[0] === "-" && className.endsWith("-0")) {
          let positiveSignature = signatures.get(className.slice(1));
          if (typeof positiveSignature === "string" && signature === positiveSignature) {
            continue;
          }
        }
        lookup.get(signature).push(className);
        designSystem.storage[UTILITY_PROPERTIES_KEY].get(options).get(className);
        for (let modifier of meta.modifiers) {
          if (isValidSpacingMultiplier(modifier)) {
            continue;
          }
          let classNameWithModifier = `${className}/${modifier}`;
          let signature2 = signatures.get(classNameWithModifier);
          if (typeof signature2 !== "string") continue;
          lookup.get(signature2).push(classNameWithModifier);
          designSystem.storage[UTILITY_PROPERTIES_KEY].get(options).get(classNameWithModifier);
        }
      }
      return lookup;
    });
  }
  var VARIANT_SIGNATURE_KEY = /* @__PURE__ */ Symbol();
  function createVariantSignatureCache(designSystem) {
    return new DefaultMap((rem) => {
      return new DefaultMap((variant) => {
        try {
          variant = designSystem.theme.prefix && !variant.startsWith(designSystem.theme.prefix) ? `${designSystem.theme.prefix}:${variant}` : variant;
          let ast = [styleRule(".x", [atRule("@apply", `${variant}:flex`)])];
          substituteAtApply(ast, designSystem);
          walk(ast, (node) => {
            if (node.kind === "at-rule") {
              node.params = constantFoldDeclaration(node.params, rem);
              if (node.params.includes(" ")) {
                node.params = node.params.replaceAll(" ", "");
              }
            } else if (node.kind === "rule") {
              let selectorAst = parse(node.selector);
              let changed = false;
              walk(selectorAst, (node2) => {
                if (node2.kind === "list" || node2.kind === "combinator") {
                  changed = true;
                } else if (node2.kind === "function" && node2.value === ":is") {
                  if (node2.nodes.length === 1) {
                    changed = true;
                    return WalkAction.Replace(node2.nodes);
                  } else if (node2.nodes.length === 2 && node2.nodes[0].kind === "selector" && node2.nodes[0].value === "*" && node2.nodes[1].kind === "selector" && node2.nodes[1].value[0] === ":") {
                    changed = true;
                    return WalkAction.Replace(node2.nodes[1]);
                  }
                } else if (node2.kind === "function" && node2.value[0] === ":" && node2.nodes[0]?.kind === "selector" && node2.nodes[0]?.value[0] === ":") {
                  changed = true;
                  node2.nodes.unshift({ kind: "selector", value: "*" });
                }
              });
              if (changed) {
                node.selector = toCss(selectorAst, true);
              }
            }
          });
          let signature = toCss3(ast);
          return signature;
        } catch {
          return /* @__PURE__ */ Symbol();
        }
      });
    });
  }
  var PRE_COMPUTED_VARIANTS_KEY = /* @__PURE__ */ Symbol();
  function createPreComputedVariantsCache(designSystem) {
    return new DefaultMap((rem) => {
      let signatures = designSystem.storage[VARIANT_SIGNATURE_KEY].get(rem);
      let lookup = new DefaultMap(() => []);
      for (let [root, variant] of designSystem.variants.entries()) {
        if (variant.kind === "static") {
          let signature = signatures.get(root);
          if (typeof signature !== "string") continue;
          lookup.get(signature).push(root);
        } else if (variant.kind === "functional") {
          for (let value2 of designSystem.variants.getCompletions(root)) {
            let name = root === "@" ? `@${value2}` : `${root}-${value2}`;
            let signature = signatures.get(name);
            if (typeof signature !== "string") continue;
            lookup.get(signature).push(name);
          }
        }
      }
      return lookup;
    });
  }
  function temporarilyDisableThemeInline(designSystem, cb) {
    let originalGet = designSystem.theme.values.get;
    let restorableInlineOptions = /* @__PURE__ */ new Set();
    designSystem.theme.values.get = (key) => {
      let value2 = originalGet.call(designSystem.theme.values, key);
      if (value2 === void 0) return value2;
      if (value2.options & 1 /* INLINE */) {
        restorableInlineOptions.add(value2);
        value2.options &= ~1 /* INLINE */;
      }
      return value2;
    };
    try {
      return cb();
    } finally {
      designSystem.theme.values.get = originalGet;
      for (let value2 of restorableInlineOptions) {
        value2.options |= 1 /* INLINE */;
      }
    }
  }
  function* combinations(arr) {
    let n = arr.length;
    let limit = 1n << BigInt(n);
    for (let k = n; k >= 2; k--) {
      let mask = (1n << BigInt(k)) - 1n;
      while (mask < limit) {
        let out = [];
        for (let i = 0; i < n; i++) {
          if (mask >> BigInt(i) & 1n) {
            out.push(arr[i]);
          }
        }
        yield out;
        let carry = mask & -mask;
        let ripple = mask + carry;
        mask = ((ripple ^ mask) >> 2n) / carry | ripple;
      }
    }
  }
  function intersection(a, b) {
    if (typeof a.intersection === "function") return a.intersection(b);
    if (a.size === 0 || b.size === 0) return /* @__PURE__ */ new Set();
    let result = new Set(a);
    for (let item of b) {
      if (!result.has(item)) {
        result.delete(item);
      }
    }
    return result;
  }

  // ../tailwindcss/packages/tailwindcss/src/intellisense.ts
  var IS_FRACTION2 = /^\d+\/\d+$/;
  function getClassList(design) {
    let items = new DefaultMap((utility) => ({
      name: utility,
      utility,
      fraction: false,
      modifiers: []
    }));
    for (let utility of design.utilities.keys("static")) {
      let completions = design.utilities.getCompletions(utility);
      if (completions.length === 0) continue;
      let item = items.get(utility);
      item.fraction = false;
      item.modifiers = [];
    }
    for (let utility of design.utilities.keys("functional")) {
      let completions = design.utilities.getCompletions(utility);
      for (let group of completions) {
        for (let value2 of group.values) {
          let fraction = value2 !== null && IS_FRACTION2.test(value2);
          let name = value2 === null ? utility : `${utility}-${value2}`;
          let item = items.get(name);
          item.utility = utility;
          item.fraction ||= fraction;
          item.modifiers.push(...group.modifiers);
          if (group.supportsNegative) {
            let item2 = items.get(`-${name}`);
            item2.utility = `-${utility}`;
            item2.fraction ||= fraction;
            item2.modifiers.push(...group.modifiers);
          }
          item.modifiers = Array.from(new Set(item.modifiers));
        }
      }
    }
    if (items.size === 0) return [];
    let list2 = Array.from(items.values());
    list2.sort((a, b) => compare(a.name, b.name));
    let entries = sortFractionsLast(list2);
    return entries;
  }
  function sortFractionsLast(list2) {
    let buckets = [];
    let current = null;
    let lastUtilityBucket = /* @__PURE__ */ new Map();
    let fractions = new DefaultMap(() => []);
    for (let item of list2) {
      let { utility, fraction } = item;
      if (!current) {
        current = { utility, items: [] };
        lastUtilityBucket.set(utility, current);
      }
      if (utility !== current.utility) {
        buckets.push(current);
        current = { utility, items: [] };
        lastUtilityBucket.set(utility, current);
      }
      if (fraction) {
        fractions.get(utility).push(item);
      } else {
        current.items.push(item);
      }
    }
    if (current && buckets[buckets.length - 1] !== current) {
      buckets.push(current);
    }
    for (let [utility, items] of fractions) {
      let bucket = lastUtilityBucket.get(utility);
      if (!bucket) continue;
      bucket.items.push(...items);
    }
    let entries = [];
    for (let bucket of buckets) {
      for (let entry of bucket.items) {
        entries.push([entry.name, { modifiers: entry.modifiers }]);
      }
    }
    return entries;
  }
  function getVariants(design) {
    let list2 = [];
    for (let [root, variant] of design.variants.entries()) {
      let selectors2 = function({ value: value2, modifier } = {}) {
        let name = root;
        if (value2) name += hasDash ? `-${value2}` : value2;
        if (modifier) name += `/${modifier}`;
        let variant2 = design.parseVariant(name);
        if (!variant2) return [];
        let node = styleRule(".__placeholder__", []);
        if (applyVariant(node, variant2, design.variants) === null) {
          return [];
        }
        let selectors3 = [];
        walk(node.nodes, {
          exit(node2, ctx) {
            if (node2.kind !== "rule" && node2.kind !== "at-rule") return;
            if (node2.nodes.length > 0) return;
            let path = ctx.path();
            path.push(node2);
            path.sort((a, b) => {
              let aIsAtRule = a.kind === "at-rule";
              let bIsAtRule = b.kind === "at-rule";
              if (aIsAtRule && !bIsAtRule) return -1;
              if (!aIsAtRule && bIsAtRule) return 1;
              return 0;
            });
            let group = path.flatMap((node3) => {
              if (node3.kind === "rule") {
                return node3.selector === "&" ? [] : [node3.selector];
              }
              if (node3.kind === "at-rule") {
                return [`${node3.name} ${node3.params}`];
              }
              return [];
            });
            let selector2 = "";
            for (let i = group.length - 1; i >= 0; i--) {
              selector2 = selector2 === "" ? group[i] : `${group[i]} { ${selector2} }`;
            }
            selectors3.push(selector2);
          }
        });
        return selectors3;
      };
      var selectors = selectors2;
      if (variant.kind === "arbitrary") continue;
      let hasDash = root !== "@";
      let values = design.variants.getCompletions(root);
      switch (variant.kind) {
        case "static": {
          list2.push({
            name: root,
            values,
            isArbitrary: false,
            hasDash,
            selectors: selectors2
          });
          break;
        }
        case "functional": {
          list2.push({
            name: root,
            values,
            isArbitrary: true,
            hasDash,
            selectors: selectors2
          });
          break;
        }
        case "compound": {
          list2.push({
            name: root,
            values,
            isArbitrary: true,
            hasDash,
            selectors: selectors2
          });
          break;
        }
      }
    }
    return list2;
  }

  // ../tailwindcss/packages/tailwindcss/src/sort.ts
  function getClassOrder(design, classes) {
    let { astNodes, nodeSorting } = compileCandidates(Array.from(classes), design);
    let sorted = new Map(classes.map((className) => [className, null]));
    let idx = 0n;
    for (let node of astNodes) {
      let candidate = nodeSorting.get(node)?.candidate;
      if (!candidate) continue;
      sorted.set(candidate, sorted.get(candidate) ?? idx++);
    }
    return classes.map((className) => [
      //
      className,
      sorted.get(className) ?? null
    ]);
  }

  // ../tailwindcss/packages/tailwindcss/src/variants.ts
  var IS_VALID_VARIANT_NAME = /^@?[a-z0-9][a-zA-Z0-9_-]*(?<![_-])$/;
  var Variants = class {
    compareFns = /* @__PURE__ */ new Map();
    variants = /* @__PURE__ */ new Map();
    completions = /* @__PURE__ */ new Map();
    /**
     * Registering a group of variants should result in the same sort number for
     * all the variants. This is to ensure that the variants are applied in the
     * correct order.
     */
    groupOrder = null;
    /**
     * Keep track of the last sort order instead of using the size of the map to
     * avoid unnecessarily skipping order numbers.
     */
    lastOrder = 0;
    static(name, applyFn, { compounds, order } = {}) {
      this.set(name, {
        kind: "static",
        applyFn,
        compoundsWith: 0 /* Never */,
        compounds: compounds ?? 2 /* StyleRules */,
        order
      });
    }
    fromAst(name, ast, designSystem) {
      let selectors = [];
      let usesAtVariant = false;
      let usesAtScope = false;
      walk(ast, (node) => {
        if (node.kind === "rule") {
          selectors.push(node.selector);
        } else if (node.kind === "at-rule" && node.name === "@variant") {
          usesAtVariant = true;
        } else if (node.kind === "at-rule" && node.name !== "@slot") {
          if (node.name === "@scope") usesAtScope = true;
          selectors.push(`${node.name} ${node.params}`);
        }
      });
      this.static(
        name,
        (r) => {
          let body = ast.map(cloneAstNode);
          if (usesAtVariant) substituteAtVariant(body, designSystem);
          if (usesAtScope) {
            substituteAtSlot(body, [context({ source: "user" }, r.nodes)]);
            r.nodes = [context({ source: "variant" }, body)];
          } else {
            substituteAtSlot(body, r.nodes);
            r.nodes = body;
          }
        },
        { compounds: compoundsForSelectors(selectors) }
      );
    }
    functional(name, applyFn, { compounds, order } = {}) {
      this.set(name, {
        kind: "functional",
        applyFn,
        compoundsWith: 0 /* Never */,
        compounds: compounds ?? 2 /* StyleRules */,
        order
      });
    }
    compound(name, compoundsWith, applyFn, { compounds, order } = {}) {
      this.set(name, {
        kind: "compound",
        applyFn,
        compoundsWith,
        compounds: compounds ?? 2 /* StyleRules */,
        order
      });
    }
    group(fn, compareFn) {
      this.groupOrder = this.nextOrder();
      if (compareFn) this.compareFns.set(this.groupOrder, compareFn);
      fn();
      this.groupOrder = null;
    }
    has(name) {
      return this.variants.has(name);
    }
    get(name) {
      return this.variants.get(name);
    }
    kind(name) {
      return this.variants.get(name)?.kind;
    }
    compoundsWith(parent, child) {
      let parentInfo = this.variants.get(parent);
      let childInfo = typeof child === "string" ? this.variants.get(child) : child.kind === "arbitrary" ? (
        // This isn't strictly necessary but it'll allow us to bail quickly
        // when parsing candidates
        { compounds: compoundsForSelectors([child.selector]) }
      ) : this.variants.get(child.root);
      if (!parentInfo || !childInfo) return false;
      if (parentInfo.kind !== "compound") return false;
      if (childInfo.compounds === 0 /* Never */) return false;
      if (parentInfo.compoundsWith === 0 /* Never */) return false;
      if ((parentInfo.compoundsWith & childInfo.compounds) === 0) return false;
      return true;
    }
    suggest(name, suggestions) {
      this.completions.set(name, suggestions);
    }
    getCompletions(name) {
      return this.completions.get(name)?.() ?? [];
    }
    compare(a, z) {
      if (a === z) return 0;
      if (a === null) return -1;
      if (z === null) return 1;
      if (a.kind === "arbitrary" && z.kind === "arbitrary") {
        return a.selector < z.selector ? -1 : 1;
      } else if (a.kind === "arbitrary") {
        return 1;
      } else if (z.kind === "arbitrary") {
        return -1;
      }
      let aOrder = this.variants.get(a.root).order;
      let zOrder = this.variants.get(z.root).order;
      let orderedByVariant = aOrder - zOrder;
      if (orderedByVariant !== 0) return orderedByVariant;
      if (a.kind === "compound" && z.kind === "compound") {
        let order = this.compare(a.variant, z.variant);
        if (order !== 0) return order;
        if (a.modifier && z.modifier) {
          return a.modifier.value < z.modifier.value ? -1 : 1;
        } else if (a.modifier) {
          return 1;
        } else if (z.modifier) {
          return -1;
        } else {
          return 0;
        }
      }
      let compareFn = this.compareFns.get(aOrder);
      if (compareFn !== void 0) return compareFn(a, z);
      if (a.root !== z.root) return a.root < z.root ? -1 : 1;
      let aValue = a.value;
      let zValue = z.value;
      if (aValue === null) return -1;
      if (zValue === null) return 1;
      if (aValue.kind === "arbitrary" && zValue.kind !== "arbitrary") return 1;
      if (aValue.kind !== "arbitrary" && zValue.kind === "arbitrary") return -1;
      return aValue.value < zValue.value ? -1 : 1;
    }
    keys() {
      return this.variants.keys();
    }
    entries() {
      return this.variants.entries();
    }
    set(name, {
      kind,
      applyFn,
      compounds,
      compoundsWith,
      order
    }) {
      let existing = this.variants.get(name);
      if (existing) {
        Object.assign(existing, { kind, applyFn, compounds });
      } else {
        if (order === void 0) {
          this.lastOrder = this.nextOrder();
          order = this.lastOrder;
        }
        this.variants.set(name, {
          kind,
          applyFn,
          order,
          compoundsWith,
          compounds
        });
      }
    }
    nextOrder() {
      return this.groupOrder ?? this.lastOrder + 1;
    }
  };
  function compoundsForSelectors(selectors) {
    let compounds = 0 /* Never */;
    for (let sel of selectors) {
      if (sel[0] === "@") {
        if (!sel.startsWith("@media") && !sel.startsWith("@supports") && !sel.startsWith("@container")) {
          return 0 /* Never */;
        }
        compounds |= 1 /* AtRules */;
        continue;
      }
      if (sel.includes("::")) {
        return 0 /* Never */;
      }
      compounds |= 2 /* StyleRules */;
    }
    return compounds;
  }
  function createVariants(theme2) {
    let variants = new Variants();
    function staticVariant(name, selectors, { compounds } = {}) {
      compounds = compounds ?? compoundsForSelectors(selectors);
      variants.static(
        name,
        (r) => {
          r.nodes = selectors.map((selector2) => rule(selector2, r.nodes));
        },
        { compounds }
      );
    }
    staticVariant("*", [":is(& > *)"], { compounds: 0 /* Never */ });
    staticVariant("**", [":is(& *)"], { compounds: 0 /* Never */ });
    function negateConditions(ruleName, conditions) {
      return conditions.map((condition) => {
        switch (ruleName) {
          case "@container": {
            let ast = parse3(condition.trim());
            if (ast.length >= 1 && ast[0].kind === "function") {
              return `not ${condition}`;
            } else if (ast.length >= 3 && ast[0].kind === "word" && ast[0].value === "not" && ast[2].kind === "function") {
              ast.splice(0, 2);
              return toCss2(ast);
            } else if (ast.length >= 5 && ast[0].kind === "word" && ast[2].kind === "word" && ast[2].value === "not" && ast[4].kind === "function") {
              ast.splice(2, 2);
              return toCss2(ast);
            } else if (ast.length >= 3 && ast[0].kind === "word" && ast[0].value !== "not" && ast[2].kind === "function") {
              ast.splice(1, 0, { kind: "separator", value: " " }, { kind: "word", value: "not" });
              return toCss2(ast);
            } else {
              return `not ${condition}`;
            }
          }
          default: {
            condition = condition.trim();
            let parts = segment(condition, " ");
            if (parts[0] === "not") {
              return parts.slice(1).join(" ");
            }
            return `not ${condition}`;
          }
        }
      });
    }
    let conditionalRules = ["@media", "@supports", "@container"];
    function negateAtRule(rule2) {
      for (let ruleName of conditionalRules) {
        if (ruleName !== rule2.name) continue;
        let conditions = segment(rule2.params, ",");
        if (conditions.length > 1) return null;
        conditions = negateConditions(rule2.name, conditions);
        return atRule(rule2.name, conditions.join(", "));
      }
      return null;
    }
    function negateSelector(selector2) {
      if (selector2.includes("::")) return null;
      let selectors = segment(selector2, ",").map((sel) => {
        sel = sel.replaceAll("&", "*");
        return sel;
      });
      return `&:not(${selectors.join(", ")})`;
    }
    variants.compound("not", 2 /* StyleRules */ | 1 /* AtRules */, (ruleNode, variant) => {
      if (variant.variant.kind === "arbitrary" && variant.variant.relative) return null;
      if (variant.modifier) return null;
      let didApply = false;
      walk([ruleNode], (node, ctx) => {
        if (node.kind !== "rule" && node.kind !== "at-rule") return WalkAction.Continue;
        if (node.nodes.length > 0) return WalkAction.Continue;
        let atRules = [];
        let styleRules = [];
        let path = ctx.path();
        path.push(node);
        for (let node2 of path) {
          if (node2.kind === "at-rule") {
            atRules.push(node2);
          } else if (node2.kind === "rule") {
            styleRules.push(node2);
          }
        }
        if (atRules.length > 1) return WalkAction.Stop;
        if (styleRules.length > 1) return WalkAction.Stop;
        let rules = [];
        for (let node2 of styleRules) {
          let selector2 = negateSelector(node2.selector);
          if (!selector2) {
            didApply = false;
            return WalkAction.Stop;
          }
          rules.push(styleRule(selector2, []));
        }
        for (let node2 of atRules) {
          let negatedAtRule = negateAtRule(node2);
          if (!negatedAtRule) {
            didApply = false;
            return WalkAction.Stop;
          }
          rules.push(negatedAtRule);
        }
        Object.assign(ruleNode, styleRule("&", rules));
        didApply = true;
        return WalkAction.Skip;
      });
      if (ruleNode.kind === "rule" && ruleNode.selector === "&" && ruleNode.nodes.length === 1) {
        Object.assign(ruleNode, ruleNode.nodes[0]);
      }
      if (!didApply) return null;
    });
    variants.suggest("not", () => {
      return Array.from(variants.keys()).filter((name) => {
        return variants.compoundsWith("not", name);
      });
    });
    variants.compound("group", 2 /* StyleRules */, (ruleNode, variant) => {
      if (variant.variant.kind === "arbitrary" && variant.variant.relative) return null;
      let variantSelector = variant.modifier ? `:where(.${theme2.prefix ? `${theme2.prefix}\\:` : ""}group\\/${variant.modifier.value})` : `:where(.${theme2.prefix ? `${theme2.prefix}\\:` : ""}group)`;
      let didApply = false;
      walk([ruleNode], (node, ctx) => {
        if (node.kind !== "rule") return WalkAction.Continue;
        for (let parent of ctx.path()) {
          if (parent.kind !== "rule") continue;
          didApply = false;
          return WalkAction.Stop;
        }
        let selector2 = node.selector.replaceAll("&", variantSelector);
        if (segment(selector2, ",").length > 1) {
          selector2 = `:is(${selector2})`;
        }
        node.selector = `&:is(${selector2} *)`;
        didApply = true;
      });
      if (!didApply) return null;
    });
    variants.suggest("group", () => {
      return Array.from(variants.keys()).filter((name) => {
        return variants.compoundsWith("group", name);
      });
    });
    variants.compound("peer", 2 /* StyleRules */, (ruleNode, variant) => {
      if (variant.variant.kind === "arbitrary" && variant.variant.relative) return null;
      let variantSelector = variant.modifier ? `:where(.${theme2.prefix ? `${theme2.prefix}\\:` : ""}peer\\/${variant.modifier.value})` : `:where(.${theme2.prefix ? `${theme2.prefix}\\:` : ""}peer)`;
      let didApply = false;
      walk([ruleNode], (node, ctx) => {
        if (node.kind !== "rule") return WalkAction.Continue;
        for (let parent of ctx.path()) {
          if (parent.kind !== "rule") continue;
          didApply = false;
          return WalkAction.Stop;
        }
        let selector2 = node.selector.replaceAll("&", variantSelector);
        if (segment(selector2, ",").length > 1) {
          selector2 = `:is(${selector2})`;
        }
        node.selector = `&:is(${selector2} ~ *)`;
        didApply = true;
      });
      if (!didApply) return null;
    });
    variants.suggest("peer", () => {
      return Array.from(variants.keys()).filter((name) => {
        return variants.compoundsWith("peer", name);
      });
    });
    staticVariant("first-letter", ["&::first-letter"]);
    staticVariant("first-line", ["&::first-line"]);
    staticVariant("marker", [
      "& *::marker",
      "&::marker",
      "& *::-webkit-details-marker",
      "&::-webkit-details-marker"
    ]);
    staticVariant("selection", ["& *::selection", "&::selection"]);
    staticVariant("file", ["&::file-selector-button"]);
    staticVariant("placeholder", ["&::placeholder"]);
    staticVariant("backdrop", ["&::backdrop"]);
    staticVariant("details-content", ["&::details-content"]);
    {
      let contentProperties2 = function() {
        return atRoot([
          atRule("@property", "--tw-content", [
            decl("syntax", '"*"'),
            decl("initial-value", '""'),
            decl("inherits", "false")
          ])
        ]);
      };
      var contentProperties = contentProperties2;
      variants.static(
        "before",
        (v) => {
          v.nodes = [
            styleRule("&::before", [
              contentProperties2(),
              decl("content", "var(--tw-content)"),
              ...v.nodes
            ])
          ];
        },
        { compounds: 0 /* Never */ }
      );
      variants.static(
        "after",
        (v) => {
          v.nodes = [
            styleRule("&::after", [
              contentProperties2(),
              decl("content", "var(--tw-content)"),
              ...v.nodes
            ])
          ];
        },
        { compounds: 0 /* Never */ }
      );
    }
    staticVariant("first", ["&:first-child"]);
    staticVariant("last", ["&:last-child"]);
    staticVariant("only", ["&:only-child"]);
    staticVariant("odd", ["&:nth-child(odd)"]);
    staticVariant("even", ["&:nth-child(even)"]);
    staticVariant("first-of-type", ["&:first-of-type"]);
    staticVariant("last-of-type", ["&:last-of-type"]);
    staticVariant("only-of-type", ["&:only-of-type"]);
    staticVariant("visited", ["&:visited"]);
    staticVariant("target", ["&:target"]);
    staticVariant("open", ["&:is([open], :popover-open, :open)"]);
    staticVariant("default", ["&:default"]);
    staticVariant("checked", ["&:checked"]);
    staticVariant("indeterminate", ["&:indeterminate"]);
    staticVariant("placeholder-shown", ["&:placeholder-shown"]);
    staticVariant("autofill", ["&:autofill"]);
    staticVariant("optional", ["&:optional"]);
    staticVariant("required", ["&:required"]);
    staticVariant("valid", ["&:valid"]);
    staticVariant("invalid", ["&:invalid"]);
    staticVariant("user-valid", ["&:user-valid"]);
    staticVariant("user-invalid", ["&:user-invalid"]);
    staticVariant("in-range", ["&:in-range"]);
    staticVariant("out-of-range", ["&:out-of-range"]);
    staticVariant("read-only", ["&:read-only"]);
    staticVariant("empty", ["&:empty"]);
    staticVariant("focus-within", ["&:focus-within"]);
    variants.static("hover", (r) => {
      r.nodes = [styleRule("&:hover", [atRule("@media", "(hover: hover)", r.nodes)])];
    });
    staticVariant("focus", ["&:focus"]);
    staticVariant("focus-visible", ["&:focus-visible"]);
    staticVariant("active", ["&:active"]);
    staticVariant("enabled", ["&:enabled"]);
    staticVariant("disabled", ["&:disabled"]);
    staticVariant("inert", ["&:is([inert], [inert] *)"]);
    variants.compound("in", 2 /* StyleRules */, (ruleNode, variant) => {
      if (variant.modifier) return null;
      let didApply = false;
      walk([ruleNode], (node, ctx) => {
        if (node.kind !== "rule") return WalkAction.Continue;
        for (let parent of ctx.path()) {
          if (parent.kind !== "rule") continue;
          didApply = false;
          return WalkAction.Stop;
        }
        node.selector = `:where(${node.selector.replaceAll("&", "*")}) &`;
        didApply = true;
      });
      if (!didApply) return null;
    });
    variants.suggest("in", () => {
      return Array.from(variants.keys()).filter((name) => {
        return variants.compoundsWith("in", name);
      });
    });
    variants.compound("has", 2 /* StyleRules */, (ruleNode, variant) => {
      if (variant.modifier) return null;
      let didApply = false;
      walk([ruleNode], (node, ctx) => {
        if (node.kind !== "rule") return WalkAction.Continue;
        for (let parent of ctx.path()) {
          if (parent.kind !== "rule") continue;
          didApply = false;
          return WalkAction.Stop;
        }
        node.selector = `&:has(${node.selector.replaceAll("&", "*")})`;
        didApply = true;
      });
      if (!didApply) return null;
    });
    variants.suggest("has", () => {
      return Array.from(variants.keys()).filter((name) => {
        return variants.compoundsWith("has", name);
      });
    });
    variants.functional("aria", (ruleNode, variant) => {
      if (!variant.value || variant.modifier) return null;
      if (variant.value.kind === "arbitrary") {
        let selector2 = `[aria-${quoteAttributeValue(variant.value.value)}]`;
        let parsed = parse4(selector2);
        if (parsed === null) return null;
        ruleNode.nodes = [styleRule(`&${selector2}`, ruleNode.nodes)];
      } else {
        let selector2 = `[aria-${variant.value.value}="true"]`;
        let parsed = parse4(selector2);
        if (parsed === null) return null;
        ruleNode.nodes = [styleRule(`&${selector2}`, ruleNode.nodes)];
      }
    });
    variants.suggest("aria", () => [
      "busy",
      "checked",
      "disabled",
      "expanded",
      "hidden",
      "pressed",
      "readonly",
      "required",
      "selected"
    ]);
    variants.functional("data", (ruleNode, variant) => {
      if (!variant.value || variant.modifier) return null;
      let selector2 = `[data-${quoteAttributeValue(variant.value.value)}]`;
      let parsed = parse4(selector2);
      if (parsed === null) return null;
      ruleNode.nodes = [styleRule(`&${selector2}`, ruleNode.nodes)];
    });
    variants.functional("nth", (ruleNode, variant) => {
      if (!variant.value || variant.modifier) return null;
      if (variant.value.kind === "named" && !isPositiveInteger(variant.value.value)) return null;
      ruleNode.nodes = [styleRule(`&:nth-child(${variant.value.value})`, ruleNode.nodes)];
    });
    variants.functional("nth-last", (ruleNode, variant) => {
      if (!variant.value || variant.modifier) return null;
      if (variant.value.kind === "named" && !isPositiveInteger(variant.value.value)) return null;
      ruleNode.nodes = [styleRule(`&:nth-last-child(${variant.value.value})`, ruleNode.nodes)];
    });
    variants.functional("nth-of-type", (ruleNode, variant) => {
      if (!variant.value || variant.modifier) return null;
      if (variant.value.kind === "named" && !isPositiveInteger(variant.value.value)) return null;
      ruleNode.nodes = [styleRule(`&:nth-of-type(${variant.value.value})`, ruleNode.nodes)];
    });
    variants.functional("nth-last-of-type", (ruleNode, variant) => {
      if (!variant.value || variant.modifier) return null;
      if (variant.value.kind === "named" && !isPositiveInteger(variant.value.value)) return null;
      ruleNode.nodes = [styleRule(`&:nth-last-of-type(${variant.value.value})`, ruleNode.nodes)];
    });
    variants.functional(
      "supports",
      (ruleNode, variant) => {
        if (!variant.value || variant.modifier) return null;
        let value2 = variant.value.value;
        if (value2 === null) return null;
        if (/^[\w-]*\s*\(/.test(value2)) {
          let changed = false;
          let ast = parse3(value2);
          walk(ast, (node) => {
            if (node.kind !== "function") return;
            if (node.value === "selector") return WalkAction.Skip;
            if (node.value === "and" || node.value === "or" || node.value === "not") {
              changed = true;
              node.value = ` ${node.value} `;
            }
          });
          let query = changed ? toCss2(ast) : value2;
          ruleNode.nodes = [atRule("@supports", query, ruleNode.nodes)];
          return;
        }
        if (!value2.includes(":")) {
          value2 = `${value2}: var(--tw)`;
        }
        if (value2[0] !== "(" || value2[value2.length - 1] !== ")") {
          value2 = `(${value2})`;
        }
        ruleNode.nodes = [atRule("@supports", value2, ruleNode.nodes)];
      },
      { compounds: 1 /* AtRules */ }
    );
    staticVariant("motion-safe", ["@media (prefers-reduced-motion: no-preference)"]);
    staticVariant("motion-reduce", ["@media (prefers-reduced-motion: reduce)"]);
    staticVariant("contrast-more", ["@media (prefers-contrast: more)"]);
    staticVariant("contrast-less", ["@media (prefers-contrast: less)"]);
    {
      let compareBreakpointVariants2 = function(a, z, direction, lookup) {
        if (a === z) return 0;
        let aValue = lookup.get(a);
        if (aValue === null) return direction === "asc" ? -1 : 1;
        let zValue = lookup.get(z);
        if (zValue === null) return direction === "asc" ? 1 : -1;
        return compareBreakpoints(aValue, zValue, direction);
      };
      var compareBreakpointVariants = compareBreakpointVariants2;
      {
        let breakpoints = theme2.namespace("--breakpoint");
        let resolvedBreakpoints = new DefaultMap((variant) => {
          switch (variant.kind) {
            case "static": {
              return theme2.resolveValue(variant.root, ["--breakpoint"]) ?? null;
            }
            case "functional": {
              if (!variant.value || variant.modifier) return null;
              let value2 = null;
              if (variant.value.kind === "arbitrary") {
                value2 = variant.value.value;
              } else if (variant.value.kind === "named") {
                value2 = theme2.resolveValue(variant.value.value, ["--breakpoint"]);
              }
              if (!value2) return null;
              if (value2.includes("var(")) return null;
              return value2;
            }
            case "arbitrary":
            case "compound":
              return null;
          }
        });
        variants.group(
          () => {
            variants.functional(
              "max",
              (ruleNode, variant) => {
                if (variant.modifier) return null;
                let value2 = resolvedBreakpoints.get(variant);
                if (value2 === null) return null;
                ruleNode.nodes = [atRule("@media", `(width < ${value2})`, ruleNode.nodes)];
              },
              { compounds: 1 /* AtRules */ }
            );
          },
          (a, z) => compareBreakpointVariants2(a, z, "desc", resolvedBreakpoints)
        );
        variants.suggest(
          "max",
          () => Array.from(breakpoints.keys()).filter((key) => key !== null)
        );
        variants.group(
          () => {
            for (let [key, value2] of theme2.namespace("--breakpoint")) {
              if (key === null) continue;
              variants.static(
                key,
                (ruleNode) => {
                  ruleNode.nodes = [atRule("@media", `(width >= ${value2})`, ruleNode.nodes)];
                },
                { compounds: 1 /* AtRules */ }
              );
            }
            variants.functional(
              "min",
              (ruleNode, variant) => {
                if (variant.modifier) return null;
                let value2 = resolvedBreakpoints.get(variant);
                if (value2 === null) return null;
                ruleNode.nodes = [atRule("@media", `(width >= ${value2})`, ruleNode.nodes)];
              },
              { compounds: 1 /* AtRules */ }
            );
          },
          (a, z) => compareBreakpointVariants2(a, z, "asc", resolvedBreakpoints)
        );
        variants.suggest(
          "min",
          () => Array.from(breakpoints.keys()).filter((key) => key !== null)
        );
      }
      {
        let widths = theme2.namespace("--container");
        let resolvedWidths = new DefaultMap((variant) => {
          switch (variant.kind) {
            case "functional": {
              if (variant.value === null) return null;
              let value2 = null;
              if (variant.value.kind === "arbitrary") {
                value2 = variant.value.value;
              } else if (variant.value.kind === "named") {
                value2 = theme2.resolveValue(variant.value.value, ["--container"]);
              }
              if (!value2) return null;
              if (value2.includes("var(")) return null;
              return value2;
            }
            case "static":
            case "arbitrary":
            case "compound":
              return null;
          }
        });
        variants.group(
          () => {
            variants.functional(
              "@max",
              (ruleNode, variant) => {
                let value2 = resolvedWidths.get(variant);
                if (value2 === null) return null;
                ruleNode.nodes = [
                  atRule(
                    "@container",
                    variant.modifier ? `${variant.modifier.value} (width < ${value2})` : `(width < ${value2})`,
                    ruleNode.nodes
                  )
                ];
              },
              { compounds: 1 /* AtRules */ }
            );
          },
          (a, z) => compareBreakpointVariants2(a, z, "desc", resolvedWidths)
        );
        variants.suggest(
          "@max",
          () => Array.from(widths.keys()).filter((key) => key !== null)
        );
        variants.group(
          () => {
            variants.functional(
              "@",
              (ruleNode, variant) => {
                let value2 = resolvedWidths.get(variant);
                if (value2 === null) return null;
                ruleNode.nodes = [
                  atRule(
                    "@container",
                    variant.modifier ? `${variant.modifier.value} (width >= ${value2})` : `(width >= ${value2})`,
                    ruleNode.nodes
                  )
                ];
              },
              { compounds: 1 /* AtRules */ }
            );
            variants.functional(
              "@min",
              (ruleNode, variant) => {
                let value2 = resolvedWidths.get(variant);
                if (value2 === null) return null;
                ruleNode.nodes = [
                  atRule(
                    "@container",
                    variant.modifier ? `${variant.modifier.value} (width >= ${value2})` : `(width >= ${value2})`,
                    ruleNode.nodes
                  )
                ];
              },
              { compounds: 1 /* AtRules */ }
            );
          },
          (a, z) => compareBreakpointVariants2(a, z, "asc", resolvedWidths)
        );
        variants.suggest(
          "@min",
          () => Array.from(widths.keys()).filter((key) => key !== null)
        );
        variants.suggest(
          "@",
          () => Array.from(widths.keys()).filter((key) => key !== null)
        );
      }
    }
    staticVariant("portrait", ["@media (orientation: portrait)"]);
    staticVariant("landscape", ["@media (orientation: landscape)"]);
    staticVariant("ltr", ['&:where(:dir(ltr), [dir="ltr"], [dir="ltr"] *)']);
    staticVariant("rtl", ['&:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)']);
    staticVariant("dark", ["@media (prefers-color-scheme: dark)"]);
    staticVariant("starting", ["@starting-style"]);
    staticVariant("print", ["@media print"]);
    staticVariant("forced-colors", ["@media (forced-colors: active)"]);
    staticVariant("inverted-colors", ["@media (inverted-colors: inverted)"]);
    staticVariant("pointer-none", ["@media (pointer: none)"]);
    staticVariant("pointer-coarse", ["@media (pointer: coarse)"]);
    staticVariant("pointer-fine", ["@media (pointer: fine)"]);
    staticVariant("any-pointer-none", ["@media (any-pointer: none)"]);
    staticVariant("any-pointer-coarse", ["@media (any-pointer: coarse)"]);
    staticVariant("any-pointer-fine", ["@media (any-pointer: fine)"]);
    staticVariant("noscript", ["@media (scripting: none)"]);
    return variants;
  }
  function quoteAttributeValue(input) {
    if (input.includes("=")) {
      let [attribute, ...after] = segment(input, "=");
      let value2 = after.join("=").trim();
      if (value2[0] === "'" || value2[0] === '"') {
        return input;
      }
      if (value2.length > 1) {
        let trailingCharacter = value2[value2.length - 1];
        if (value2[value2.length - 2] === " " && (trailingCharacter === "i" || trailingCharacter === "I" || trailingCharacter === "s" || trailingCharacter === "S")) {
          return `${attribute}="${value2.slice(0, -2)}" ${trailingCharacter}`;
        }
      }
      return `${attribute}="${value2}"`;
    }
    return input;
  }
  function substituteAtSlot(ast, nodes) {
    walk(ast, (node) => {
      if (node.kind === "at-rule" && node.name === "@slot") {
        return WalkAction.ReplaceSkip(nodes);
      } else if (node.kind === "at-rule" && (node.name === "@keyframes" || node.name === "@property")) {
        Object.assign(node, atRoot([atRule(node.name, node.params, node.nodes)]));
        return WalkAction.Skip;
      }
    });
  }
  function substituteAtVariant(ast, designSystem) {
    let features = 0 /* None */;
    walk(ast, (variantNode) => {
      if (variantNode.kind !== "at-rule" || variantNode.name !== "@variant") return;
      let nodes = [];
      let compoundVariants = segment(variantNode.params, ",");
      for (let [idx, compoundVariant] of compoundVariants.entries()) {
        let node = styleRule(
          "&",
          idx === compoundVariants.length - 1 ? variantNode.nodes : variantNode.nodes.map(cloneAstNode)
        );
        let stackedVariants = segment(compoundVariant, ":");
        for (let i = stackedVariants.length - 1; i >= 0; --i) {
          let variant = stackedVariants[i].trim();
          if (!variant) {
            throw new Error(`Cannot use \`@variant\` with empty variant`);
          }
          let variantAst = designSystem.parseVariant(variant);
          if (variantAst === null) {
            throw new Error(`Cannot use \`@variant\` with unknown variant: ${variant}`);
          }
          let result = applyVariant(node, variantAst, designSystem.variants);
          if (result === null) {
            throw new Error(`Cannot use \`@variant\` with variant: ${variant}`);
          }
        }
        if (node.selector === "&") {
          nodes.push(...node.nodes);
        } else {
          nodes.push(node);
        }
      }
      features |= 32 /* Variants */;
      return WalkAction.Replace(nodes);
    });
    return features;
  }

  // ../tailwindcss/packages/tailwindcss/src/design-system.ts
  function buildDesignSystem(theme2, utilitiesSrc) {
    let utilities2 = createUtilities(theme2);
    let variants = createVariants(theme2);
    let parsedVariants = new DefaultMap((variant) => parseVariant(variant, designSystem));
    let cachedVariantOrder = null;
    let cachedVariantOrderSize = -1;
    let parsedCandidates = new DefaultMap(
      (candidate) => Array.from(parseCandidate(candidate, designSystem))
    );
    let compiledAstNodes = new DefaultMap((flags) => {
      return new DefaultMap((candidate) => {
        let ast = compileAstNodes(candidate, designSystem, flags);
        try {
          let nodes = ast.map((value2) => value2.node);
          substituteFunctions(nodes, designSystem);
          substituteAtVariant(nodes, designSystem);
        } catch (err) {
          return [];
        }
        return ast;
      });
    });
    let trackUsedVariables = new DefaultMap((raw) => {
      for (let variable of extractUsedVariables(raw)) {
        theme2.markUsedVariable(variable);
      }
    });
    function candidatesToAst(classes) {
      let result = [];
      for (let className of classes) {
        let wasValid = true;
        let { astNodes } = compileCandidates([className], designSystem, {
          onInvalidCandidate() {
            wasValid = false;
          }
        });
        if (utilitiesSrc) {
          walk(astNodes, (node) => {
            node.src ??= utilitiesSrc;
            return WalkAction.Continue;
          });
        }
        astNodes = optimizeAst(astNodes, designSystem, 0 /* None */);
        result.push(wasValid ? astNodes : []);
      }
      return result;
    }
    function candidatesToCss(classes) {
      return candidatesToAst(classes).map((nodes) => {
        return nodes.length > 0 ? toCss3(nodes) : null;
      });
    }
    let designSystem = {
      theme: theme2,
      utilities: utilities2,
      variants,
      invalidCandidates: /* @__PURE__ */ new Set(),
      important: false,
      candidatesToCss,
      candidatesToAst,
      getClassOrder(classes) {
        return getClassOrder(this, classes);
      },
      getClassList() {
        return getClassList(this);
      },
      getVariants() {
        return getVariants(this);
      },
      parseCandidate(candidate) {
        return parsedCandidates.get(candidate);
      },
      parseVariant(variant) {
        return parsedVariants.get(variant);
      },
      compileAstNodes(candidate, flags = 1 /* RespectImportant */) {
        return compiledAstNodes.get(flags).get(candidate);
      },
      printCandidate(candidate) {
        return printCandidate(designSystem, candidate);
      },
      printVariant(variant) {
        return printVariant(variant);
      },
      getVariantOrder() {
        if (cachedVariantOrder !== null && cachedVariantOrderSize === parsedVariants.size) {
          return cachedVariantOrder;
        }
        let variants2 = Array.from(parsedVariants.values());
        variants2.sort((a, z) => this.variants.compare(a, z));
        let order = /* @__PURE__ */ new Map();
        let prevVariant = void 0;
        let index = 0;
        for (let variant of variants2) {
          if (variant === null) {
            continue;
          }
          if (prevVariant !== void 0 && this.variants.compare(prevVariant, variant) !== 0) {
            index++;
          }
          order.set(variant, index);
          prevVariant = variant;
        }
        cachedVariantOrder = order;
        cachedVariantOrderSize = parsedVariants.size;
        return order;
      },
      resolveThemeValue(path, forceInline = true) {
        let lastSlash = path.lastIndexOf("/");
        let modifier = null;
        if (lastSlash !== -1) {
          modifier = path.slice(lastSlash + 1).trim();
          path = path.slice(0, lastSlash).trim();
        }
        let themeValue = theme2.resolve(null, [path], forceInline ? 1 /* INLINE */ : 0 /* NONE */) ?? void 0;
        if (modifier && themeValue) {
          return withAlpha(themeValue, modifier);
        }
        return themeValue;
      },
      trackUsedVariables(raw) {
        trackUsedVariables.get(raw);
      },
      canonicalizeCandidates(candidates, options) {
        return canonicalizeCandidates(this, candidates, options);
      },
      // General purpose storage, each key has to be a unique symbol to avoid
      // collisions.
      storage: {}
    };
    return designSystem;
  }

  // ../tailwindcss/packages/tailwindcss/src/property-order.ts
  var property_order_default = [
    "container-type",
    "pointer-events",
    "visibility",
    "position",
    // How do we make `inset-x-0` come before `top-0`?
    "inset",
    "inset-inline",
    "inset-block",
    "inset-inline-start",
    "inset-inline-end",
    "inset-block-start",
    "inset-block-end",
    "top",
    "right",
    "bottom",
    "left",
    "isolation",
    "z-index",
    "order",
    "grid-column",
    "grid-column-start",
    "grid-column-end",
    "grid-row",
    "grid-row-start",
    "grid-row-end",
    "float",
    "clear",
    // Ensure that the included `container` class is always sorted before any
    // custom container extensions
    "--tw-container-component",
    // How do we make `mx-0` come before `mt-0`?
    // Idea: `margin-x` property that we compile away with a Visitor plugin?
    "margin",
    "margin-inline",
    "margin-block",
    "margin-inline-start",
    "margin-inline-end",
    "margin-block-start",
    "margin-block-end",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "box-sizing",
    "display",
    "field-sizing",
    "aspect-ratio",
    "height",
    "max-height",
    "min-height",
    "width",
    "max-width",
    "min-width",
    "flex",
    "flex-shrink",
    "flex-grow",
    "flex-basis",
    "table-layout",
    "caption-side",
    "border-collapse",
    // There's no `border-spacing-x` property, we use variables, how to sort?
    "border-spacing",
    // '--tw-border-spacing-x',
    // '--tw-border-spacing-y',
    "transform-origin",
    "translate",
    "--tw-translate-x",
    "--tw-translate-y",
    "--tw-translate-z",
    "scale",
    "--tw-scale-x",
    "--tw-scale-y",
    "--tw-scale-z",
    "rotate",
    "--tw-rotate-x",
    "--tw-rotate-y",
    "--tw-rotate-z",
    "--tw-skew-x",
    "--tw-skew-y",
    "transform",
    "zoom",
    "animation",
    "cursor",
    "touch-action",
    "--tw-pan-x",
    "--tw-pan-y",
    "--tw-pinch-zoom",
    "resize",
    "scroll-snap-type",
    "--tw-scroll-snap-strictness",
    "scroll-snap-align",
    "scroll-snap-stop",
    "scroll-margin",
    "scroll-margin-inline",
    "scroll-margin-block",
    "scroll-margin-inline-start",
    "scroll-margin-inline-end",
    "scroll-margin-block-start",
    "scroll-margin-block-end",
    "scroll-margin-top",
    "scroll-margin-right",
    "scroll-margin-bottom",
    "scroll-margin-left",
    "scroll-padding",
    "scroll-padding-inline",
    "scroll-padding-block",
    "scroll-padding-inline-start",
    "scroll-padding-inline-end",
    "scroll-padding-block-start",
    "scroll-padding-block-end",
    "scroll-padding-top",
    "scroll-padding-right",
    "scroll-padding-bottom",
    "scroll-padding-left",
    "scrollbar-width",
    "scrollbar-color",
    "scrollbar-gutter",
    "list-style-position",
    "list-style-type",
    "list-style-image",
    "appearance",
    "columns",
    "break-before",
    "break-inside",
    "break-after",
    "grid-auto-columns",
    "grid-auto-flow",
    "grid-auto-rows",
    "grid-template-columns",
    "grid-template-rows",
    "flex-direction",
    "flex-wrap",
    "place-content",
    "place-items",
    "align-content",
    "align-items",
    "justify-content",
    "justify-items",
    "gap",
    "column-gap",
    "row-gap",
    "--tw-space-x-reverse",
    "--tw-space-y-reverse",
    // Is there a more "real" property we could use for this?
    "divide-x-width",
    "divide-y-width",
    "--tw-divide-y-reverse",
    "divide-style",
    "divide-color",
    "place-self",
    "align-self",
    "justify-self",
    "overflow",
    "overflow-x",
    "overflow-y",
    "overscroll-behavior",
    "overscroll-behavior-x",
    "overscroll-behavior-y",
    "scroll-behavior",
    "border-radius",
    "border-start-radius",
    // Not real
    "border-end-radius",
    // Not real
    "border-top-radius",
    // Not real
    "border-right-radius",
    // Not real
    "border-bottom-radius",
    // Not real
    "border-left-radius",
    // Not real
    "border-start-start-radius",
    "border-start-end-radius",
    "border-end-end-radius",
    "border-end-start-radius",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
    "border-width",
    "border-inline-width",
    "border-block-width",
    "border-inline-start-width",
    "border-inline-end-width",
    "border-block-start-width",
    "border-block-end-width",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "border-style",
    "border-inline-style",
    "border-block-style",
    "border-inline-start-style",
    "border-inline-end-style",
    "border-block-start-style",
    "border-block-end-style",
    "border-top-style",
    "border-right-style",
    "border-bottom-style",
    "border-left-style",
    "border-color",
    "border-inline-color",
    "border-block-color",
    "border-inline-start-color",
    "border-inline-end-color",
    "border-block-start-color",
    "border-block-end-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "background-color",
    "background-image",
    "--tw-gradient-position",
    "--tw-gradient-stops",
    "--tw-gradient-via-stops",
    "--tw-gradient-from",
    "--tw-gradient-from-position",
    "--tw-gradient-via",
    "--tw-gradient-via-position",
    "--tw-gradient-to",
    "--tw-gradient-to-position",
    "mask-image",
    // Edge masks
    "--tw-mask-top",
    "--tw-mask-top-from-color",
    "--tw-mask-top-from-position",
    "--tw-mask-top-to-color",
    "--tw-mask-top-to-position",
    "--tw-mask-right",
    "--tw-mask-right-from-color",
    "--tw-mask-right-from-position",
    "--tw-mask-right-to-color",
    "--tw-mask-right-to-position",
    "--tw-mask-bottom",
    "--tw-mask-bottom-from-color",
    "--tw-mask-bottom-from-position",
    "--tw-mask-bottom-to-color",
    "--tw-mask-bottom-to-position",
    "--tw-mask-left",
    "--tw-mask-left-from-color",
    "--tw-mask-left-from-position",
    "--tw-mask-left-to-color",
    "--tw-mask-left-to-position",
    // Linear masks
    "--tw-mask-linear",
    "--tw-mask-linear-position",
    "--tw-mask-linear-from-color",
    "--tw-mask-linear-from-position",
    "--tw-mask-linear-to-color",
    "--tw-mask-linear-to-position",
    // Radial masks
    "--tw-mask-radial",
    "--tw-mask-radial-shape",
    "--tw-mask-radial-size",
    "--tw-mask-radial-position",
    "--tw-mask-radial-from-color",
    "--tw-mask-radial-from-position",
    "--tw-mask-radial-to-color",
    "--tw-mask-radial-to-position",
    // Conic masks
    "--tw-mask-conic",
    "--tw-mask-conic-position",
    "--tw-mask-conic-from-color",
    "--tw-mask-conic-from-position",
    "--tw-mask-conic-to-color",
    "--tw-mask-conic-to-position",
    "box-decoration-break",
    "background-size",
    "background-attachment",
    "background-clip",
    "background-position",
    "background-repeat",
    "background-origin",
    "mask-composite",
    "mask-mode",
    "mask-type",
    "mask-size",
    "mask-clip",
    "mask-position",
    "mask-repeat",
    "mask-origin",
    "fill",
    "stroke",
    "stroke-width",
    "object-fit",
    "object-position",
    "padding",
    "padding-inline",
    "padding-block",
    "padding-inline-start",
    "padding-inline-end",
    "padding-block-start",
    "padding-block-end",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "text-align",
    "text-indent",
    "vertical-align",
    "font-family",
    "font-feature-settings",
    "font-size",
    "line-height",
    "font-weight",
    "letter-spacing",
    "text-wrap",
    "overflow-wrap",
    "word-break",
    "text-overflow",
    "hyphens",
    "white-space",
    "tab-size",
    "color",
    "text-transform",
    "font-style",
    "font-stretch",
    "font-variant-numeric",
    "text-decoration-line",
    "text-decoration-color",
    "text-decoration-style",
    "text-decoration-thickness",
    "text-underline-offset",
    "-webkit-font-smoothing",
    "placeholder-color",
    "caret-color",
    "accent-color",
    "color-scheme",
    "opacity",
    "background-blend-mode",
    "mix-blend-mode",
    "box-shadow",
    "--tw-shadow",
    "--tw-shadow-color",
    "--tw-ring-shadow",
    "--tw-ring-color",
    "--tw-inset-shadow",
    "--tw-inset-shadow-color",
    "--tw-inset-ring-shadow",
    "--tw-inset-ring-color",
    "--tw-ring-offset-width",
    "--tw-ring-offset-color",
    "outline",
    "outline-width",
    "outline-offset",
    "outline-color",
    "--tw-blur",
    "--tw-brightness",
    "--tw-contrast",
    "--tw-drop-shadow",
    "--tw-grayscale",
    "--tw-hue-rotate",
    "--tw-invert",
    "--tw-saturate",
    "--tw-sepia",
    "filter",
    "--tw-backdrop-blur",
    "--tw-backdrop-brightness",
    "--tw-backdrop-contrast",
    "--tw-backdrop-grayscale",
    "--tw-backdrop-hue-rotate",
    "--tw-backdrop-invert",
    "--tw-backdrop-opacity",
    "--tw-backdrop-saturate",
    "--tw-backdrop-sepia",
    "backdrop-filter",
    "transition-property",
    "transition-behavior",
    "transition-delay",
    "transition-duration",
    "transition-timing-function",
    "will-change",
    "contain",
    "content",
    "forced-color-adjust"
  ];

  // ../tailwindcss/packages/tailwindcss/src/compile.ts
  function compileCandidates(rawCandidates, designSystem, {
    onInvalidCandidate,
    respectImportant
  } = {}) {
    let nodeSorting = /* @__PURE__ */ new Map();
    let astNodes = [];
    let matches = /* @__PURE__ */ new Map();
    for (let rawCandidate of rawCandidates) {
      if (designSystem.invalidCandidates.has(rawCandidate)) {
        onInvalidCandidate?.(rawCandidate);
        continue;
      }
      let candidates = designSystem.parseCandidate(rawCandidate);
      if (candidates.length === 0) {
        onInvalidCandidate?.(rawCandidate);
        continue;
      }
      matches.set(rawCandidate, candidates);
    }
    let flags = 0 /* None */;
    if (respectImportant ?? true) {
      flags |= 1 /* RespectImportant */;
    }
    let variantOrderMap = designSystem.getVariantOrder();
    for (let [rawCandidate, candidates] of matches) {
      let found = false;
      for (let candidate of candidates) {
        let rules = designSystem.compileAstNodes(candidate, flags);
        if (rules.length === 0) continue;
        found = true;
        for (let { node, propertySort } of rules) {
          let variantOrder = 0n;
          for (let variant of candidate.variants) {
            variantOrder |= 1n << BigInt(variantOrderMap.get(variant));
          }
          nodeSorting.set(node, {
            properties: propertySort,
            variants: variantOrder,
            candidate: rawCandidate
          });
          astNodes.push(node);
        }
      }
      if (!found) {
        onInvalidCandidate?.(rawCandidate);
      }
    }
    astNodes.sort((a, z) => {
      let aSorting = nodeSorting.get(a);
      let zSorting = nodeSorting.get(z);
      if (aSorting.variants - zSorting.variants !== 0n) {
        return Number(aSorting.variants - zSorting.variants);
      }
      let offset = 0;
      while (offset < aSorting.properties.order.length && offset < zSorting.properties.order.length && aSorting.properties.order[offset] === zSorting.properties.order[offset]) {
        offset += 1;
      }
      return (
        // Sort by lowest property index first
        (aSorting.properties.order[offset] ?? Infinity) - (zSorting.properties.order[offset] ?? Infinity) || // Sort by most properties first, then by least properties
        zSorting.properties.count - aSorting.properties.count || // Sort alphabetically
        compare(aSorting.candidate, zSorting.candidate)
      );
    });
    return {
      astNodes,
      nodeSorting
    };
  }
  function compileAstNodes(candidate, designSystem, flags) {
    let asts = compileBaseUtility(candidate, designSystem);
    if (asts.length === 0) return [];
    let respectImportant = designSystem.important && Boolean(flags & 1 /* RespectImportant */);
    let rules = [];
    let selector2 = `.${escape(candidate.raw)}`;
    for (let nodes of asts) {
      let propertySort = getPropertySort(nodes);
      if (candidate.important || respectImportant) {
        applyImportant(nodes);
      }
      let node = {
        kind: "rule",
        selector: selector2,
        nodes
      };
      for (let variant of candidate.variants) {
        let result = applyVariant(node, variant, designSystem.variants);
        if (result === null) return [];
      }
      rules.push({
        node,
        propertySort
      });
    }
    return rules;
  }
  function applyVariant(node, variant, variants, depth = 0) {
    if (variant.kind === "arbitrary") {
      if (variant.relative && depth === 0) return null;
      let child = rule(variant.selector, node.nodes);
      if (child.kind === "at-rule" && child.name === "@scope") {
        child.nodes = [context({ source: "user" }, node.nodes)];
        child = context({ source: "variant" }, [child]);
      }
      node.nodes = [child];
      return;
    }
    let { applyFn } = variants.get(variant.root);
    if (variant.kind === "compound") {
      let isolatedNode = atRule("@slot");
      let result2 = applyVariant(isolatedNode, variant.variant, variants, depth + 1);
      if (result2 === null) return null;
      if (variant.root === "not" && isolatedNode.nodes.length > 1) {
        return null;
      }
      for (let child of isolatedNode.nodes) {
        if (child.kind !== "rule" && child.kind !== "at-rule") return null;
        let result3 = applyFn(child, variant);
        if (result3 === null) return null;
      }
      {
        walk(isolatedNode.nodes, (child) => {
          if ((child.kind === "rule" || child.kind === "at-rule") && child.nodes.length <= 0) {
            child.nodes = node.nodes;
            return WalkAction.Skip;
          }
        });
        node.nodes = isolatedNode.nodes;
      }
      return;
    }
    let result = applyFn(node, variant);
    if (result === null) return null;
  }
  function isFallbackUtility(utility) {
    let types = utility.options?.types ?? [];
    return types.length > 1 && types.includes("any");
  }
  function compileBaseUtility(candidate, designSystem) {
    if (candidate.kind === "arbitrary") {
      let value2 = candidate.value;
      if (candidate.modifier) {
        value2 = asColor(value2, candidate.modifier, designSystem.theme);
      }
      if (value2 === null) return [];
      return [[decl(candidate.property, value2)]];
    }
    let utilities2 = designSystem.utilities.get(candidate.root) ?? [];
    let asts = [];
    let normalUtilities = utilities2.filter((u) => !isFallbackUtility(u));
    for (let utility of normalUtilities) {
      if (utility.kind !== candidate.kind) continue;
      let compiledNodes = utility.compileFn(candidate);
      if (compiledNodes === void 0) continue;
      if (compiledNodes === null) {
        if (utility.options?.types?.length) return asts;
        continue;
      }
      asts.push(compiledNodes);
    }
    if (asts.length > 0) return asts;
    let fallbackUtilities = utilities2.filter((u) => isFallbackUtility(u));
    for (let utility of fallbackUtilities) {
      if (utility.kind !== candidate.kind) continue;
      let compiledNodes = utility.compileFn(candidate);
      if (compiledNodes === void 0) continue;
      if (compiledNodes === null) {
        if (utility.options?.types?.length) return asts;
        continue;
      }
      asts.push(compiledNodes);
    }
    return asts;
  }
  function applyImportant(ast) {
    for (let node of ast) {
      if (node.kind === "at-root") {
        continue;
      }
      if (node.kind === "declaration") {
        node.important = true;
      } else if (node.kind === "rule" || node.kind === "at-rule") {
        applyImportant(node.nodes);
      }
    }
  }
  function getPropertySort(nodes) {
    let order = /* @__PURE__ */ new Set();
    let count = 0;
    let q = nodes.slice();
    let seenTwSort = false;
    while (q.length > 0) {
      let node = q.shift();
      if (node.kind === "declaration") {
        if (node.value === void 0) continue;
        count++;
        if (seenTwSort) continue;
        if (node.property === "--tw-sort") {
          let idx2 = property_order_default.indexOf(node.value ?? "");
          if (idx2 !== -1) {
            order.add(idx2);
            seenTwSort = true;
            continue;
          }
        }
        let idx = property_order_default.indexOf(node.property);
        if (idx !== -1) order.add(idx);
      } else if (node.kind === "rule" || node.kind === "at-rule") {
        for (let child of node.nodes) {
          q.push(child);
        }
      }
    }
    return {
      order: Array.from(order).sort((a, z) => a - z),
      count
    };
  }

  // ../tailwindcss/packages/tailwindcss/src/apply.ts
  function substituteAtApply(ast, designSystem) {
    let features = 0 /* None */;
    let root = rule("&", ast);
    let parents = /* @__PURE__ */ new Set();
    let dependencies = new DefaultMap(() => /* @__PURE__ */ new Set());
    let definitions = new DefaultMap(() => /* @__PURE__ */ new Set());
    walk([root], (node, ctx) => {
      if (node.kind !== "at-rule") return;
      if (node.name === "@keyframes") {
        walk(node.nodes, (child) => {
          if (child.kind === "at-rule" && child.name === "@apply") {
            throw new Error(`You cannot use \`@apply\` inside \`@keyframes\`.`);
          }
        });
        return WalkAction.Skip;
      }
      if (node.name === "@utility") {
        let name = node.params.replace(/-\*$/, "");
        definitions.get(name).add(node);
        walk(node.nodes, (child) => {
          if (child.kind !== "at-rule" || child.name !== "@apply") return;
          parents.add(node);
          for (let dependency of resolveApplyDependencies(child, designSystem)) {
            dependencies.get(node).add(dependency);
          }
        });
        return;
      }
      if (node.name === "@apply") {
        if (ctx.parent === null) return;
        features |= 1 /* AtApply */;
        parents.add(ctx.parent);
        for (let dependency of resolveApplyDependencies(node, designSystem)) {
          for (let parent of ctx.path()) {
            if (!parents.has(parent)) continue;
            dependencies.get(parent).add(dependency);
          }
        }
      }
    });
    let seen = /* @__PURE__ */ new Set();
    let sorted = [];
    let wip = /* @__PURE__ */ new Set();
    function visit(node, path = []) {
      if (seen.has(node)) {
        return;
      }
      if (wip.has(node)) {
        let next = path[(path.indexOf(node) + 1) % path.length];
        if (node.kind === "at-rule" && node.name === "@utility" && next.kind === "at-rule" && next.name === "@utility") {
          walk(node.nodes, (child) => {
            if (child.kind !== "at-rule" || child.name !== "@apply") return;
            let candidates = child.params.split(/\s+/g);
            for (let candidate of candidates) {
              for (let candidateAstNode of designSystem.parseCandidate(candidate)) {
                switch (candidateAstNode.kind) {
                  case "arbitrary":
                    break;
                  case "static":
                  case "functional":
                    if (next.params.replace(/-\*$/, "") === candidateAstNode.root) {
                      throw new Error(
                        `You cannot \`@apply\` the \`${candidate}\` utility here because it creates a circular dependency.`
                      );
                    }
                    break;
                  default:
                    candidateAstNode;
                }
              }
            }
          });
        }
        throw new Error(
          `Circular dependency detected:

${toCss3([node])}
Relies on:

${toCss3([next])}`
        );
      }
      wip.add(node);
      for (let dependencyId of dependencies.get(node)) {
        for (let dependency of definitions.get(dependencyId)) {
          path.push(node);
          visit(dependency, path);
          path.pop();
        }
      }
      seen.add(node);
      wip.delete(node);
      sorted.push(node);
    }
    for (let node of parents) {
      visit(node);
    }
    for (let parent of sorted) {
      if (!("nodes" in parent)) continue;
      walk(parent.nodes, (child) => {
        if (child.kind !== "at-rule" || child.name !== "@apply") return;
        let parts = child.params.split(/(\s+)/g);
        let candidateOffsets = {};
        let normalIdents = [];
        let dashedIdents = [];
        let offset = 0;
        for (let [idx, part] of parts.entries()) {
          if (idx % 2 === 0) {
            if (part[0] === "-" && part[1] === "-") {
              dashedIdents.push(part);
            } else {
              normalIdents.push(part);
            }
            candidateOffsets[part] = offset;
          }
          offset += part.length;
        }
        if (dashedIdents.length) {
          if (normalIdents.length === 0) return WalkAction.Skip;
          let list2 = dashedIdents.join(" ");
          throw new Error(
            `You cannot use \`@apply\` with both mixins and utilities. Please move \`@apply ${list2}\` into a separate rule.`
          );
        }
        let hasBody = child.nodes.length > 0;
        if (hasBody && normalIdents.length) {
          let list2 = normalIdents.join(" ");
          throw new Error(`The rule \`@apply ${list2}\` must not have a body.`);
        }
        {
          let candidates = Object.keys(candidateOffsets);
          let compiled = compileCandidates(candidates, designSystem, {
            respectImportant: false,
            onInvalidCandidate: (candidate) => {
              if (designSystem.theme.prefix && !candidate.startsWith(designSystem.theme.prefix)) {
                throw new Error(
                  `Cannot apply unprefixed utility class \`${candidate}\`. Did you mean \`${designSystem.theme.prefix}:${candidate}\`?`
                );
              }
              if (designSystem.invalidCandidates.has(candidate)) {
                throw new Error(
                  `Cannot apply utility class \`${candidate}\` because it has been explicitly disabled: https://tailwindcss.com/docs/detecting-classes-in-source-files#explicitly-excluding-classes`
                );
              }
              let parts2 = segment(candidate, ":");
              if (parts2.length > 1) {
                let utility = parts2.pop();
                if (designSystem.candidatesToCss([utility])[0]) {
                  let compiledVariants = designSystem.candidatesToCss(
                    parts2.map((variant) => `${variant}:[--tw-variant-check:1]`)
                  );
                  let unknownVariants = parts2.filter((_, idx) => compiledVariants[idx] === null);
                  if (unknownVariants.length > 0) {
                    if (unknownVariants.length === 1) {
                      throw new Error(
                        `Cannot apply utility class \`${candidate}\` because the ${unknownVariants.map((variant) => `\`${variant}\``)} variant does not exist.`
                      );
                    } else {
                      let formatter = new Intl.ListFormat("en", {
                        style: "long",
                        type: "conjunction"
                      });
                      throw new Error(
                        `Cannot apply utility class \`${candidate}\` because the ${formatter.format(unknownVariants.map((variant) => `\`${variant}\``))} variants do not exist.`
                      );
                    }
                  }
                }
              }
              if (designSystem.theme.size === 0) {
                throw new Error(
                  `Cannot apply unknown utility class \`${candidate}\`. Are you using CSS modules or similar and missing \`@reference\`? https://tailwindcss.com/docs/functions-and-directives#reference-directive`
                );
              }
              throw new Error(`Cannot apply unknown utility class \`${candidate}\``);
            }
          });
          let src = child.src;
          let candidateAst = compiled.astNodes.map((node) => {
            let candidate = compiled.nodeSorting.get(node)?.candidate;
            let candidateOffset = candidate ? candidateOffsets[candidate] : void 0;
            node = cloneAstNode(node);
            if (!src || !candidate || candidateOffset === void 0) {
              walk([node], (node2) => {
                node2.src = src;
              });
              return node;
            }
            let candidateSrc = [src[0], src[1], src[2]];
            candidateSrc[1] += 7 + candidateOffset;
            candidateSrc[2] = candidateSrc[1] + candidate.length;
            walk([node], (node2) => {
              node2.src = candidateSrc;
            });
            return node;
          });
          let newNodes = [];
          for (let candidateNode of candidateAst) {
            if (candidateNode.kind === "rule") {
              for (let child2 of candidateNode.nodes) {
                newNodes.push(child2);
              }
            } else {
              newNodes.push(candidateNode);
            }
          }
          return WalkAction.Replace(newNodes);
        }
      });
    }
    return features;
  }
  function* resolveApplyDependencies(node, designSystem) {
    for (let candidate of node.params.split(/\s+/g)) {
      for (let node2 of designSystem.parseCandidate(candidate)) {
        switch (node2.kind) {
          case "arbitrary":
            break;
          case "static":
          case "functional":
            yield node2.root;
            break;
          default:
            node2;
        }
      }
    }
  }

  // ../tailwindcss/packages/tailwindcss/src/at-import.ts
  async function substituteAtImports(ast, base2, loadStylesheet, recurseCount = 0, track = false) {
    let features = 0 /* None */;
    let promises = [];
    walk(ast, (node) => {
      if (node.kind === "at-rule" && (node.name === "@import" || node.name === "@reference")) {
        let parsed = parseImportParams(parse3(node.params));
        if (parsed === null) return;
        if (node.name === "@reference") {
          parsed.media = "reference";
        }
        features |= 2 /* AtImport */;
        let { uri, layer, media, supports } = parsed;
        if (uri.startsWith("data:")) return;
        if (uri.startsWith("http://") || uri.startsWith("https://")) return;
        let contextNode = context({}, []);
        promises.push(
          (async () => {
            if (recurseCount > 100) {
              throw new Error(
                `Exceeded maximum recursion depth while resolving \`${uri}\` in \`${base2}\`)`
              );
            }
            let loaded = await loadStylesheet(uri, base2);
            let ast2 = parse2(loaded.content, { from: track ? loaded.path : void 0 });
            await substituteAtImports(ast2, loaded.base, loadStylesheet, recurseCount + 1, track);
            contextNode.nodes = buildImportNodes(
              node,
              [context({ base: loaded.base }, ast2)],
              layer,
              media,
              supports
            );
          })()
        );
        return WalkAction.ReplaceSkip(contextNode);
      }
    });
    if (promises.length > 0) {
      await Promise.all(promises);
    }
    return features;
  }
  function parseImportParams(params) {
    let uri;
    let layer = null;
    let media = null;
    let supports = null;
    for (let i = 0; i < params.length; i++) {
      let node = params[i];
      if (node.kind === "separator") continue;
      if (node.kind === "word" && !uri) {
        if (!node.value) return null;
        if (node.value[0] !== '"' && node.value[0] !== "'") return null;
        uri = node.value.slice(1, -1);
        continue;
      }
      if (node.kind === "function" && node.value.toLowerCase() === "url") {
        return null;
      }
      if (!uri) return null;
      if ((node.kind === "word" || node.kind === "function") && node.value.toLowerCase() === "layer") {
        if (layer) return null;
        if (supports) {
          throw new Error(
            "`layer(\u2026)` in an `@import` should come before any other functions or conditions"
          );
        }
        if ("nodes" in node) {
          layer = toCss2(node.nodes);
        } else {
          layer = "";
        }
        continue;
      }
      if (node.kind === "function" && node.value.toLowerCase() === "supports") {
        if (supports) return null;
        supports = toCss2(node.nodes);
        continue;
      }
      media = toCss2(params.slice(i));
      break;
    }
    if (!uri) return null;
    return { uri, layer, media, supports };
  }
  function buildImportNodes(importNode, importedAst, layer, media, supports) {
    let root = importedAst;
    if (layer !== null) {
      let node = atRule("@layer", layer, root);
      node.src = importNode.src;
      root = [node];
    }
    if (media !== null) {
      let node = atRule("@media", media, root);
      node.src = importNode.src;
      root = [node];
    }
    if (supports !== null) {
      let node = atRule("@supports", supports[0] === "(" ? supports : `(${supports})`, root);
      node.src = importNode.src;
      root = [node];
    }
    return root;
  }

  // ../tailwindcss/packages/tailwindcss/src/compat/config/deep-merge.ts
  function isPlainObject(value2) {
    if (Object.prototype.toString.call(value2) !== "[object Object]") {
      return false;
    }
    const prototype = Object.getPrototypeOf(value2);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
  }
  function deepMerge(target, sources, customizer, path = []) {
    for (let source of sources) {
      if (source === null || source === void 0) {
        continue;
      }
      for (let k of Reflect.ownKeys(source)) {
        path.push(k);
        let merged = customizer(target[k], source[k], path);
        if (merged !== void 0) {
          target[k] = merged;
        } else if (!isPlainObject(target[k]) || !isPlainObject(source[k])) {
          target[k] = source[k];
        } else {
          target[k] = deepMerge({}, [target[k], source[k]], customizer, path);
        }
        path.pop();
      }
    }
    return target;
  }

  // ../tailwindcss/packages/tailwindcss/src/compat/plugin-functions.ts
  function createThemeFn(designSystem, configTheme, resolveValue) {
    return function theme2(path, defaultValue) {
      let lastSlash = path.lastIndexOf("/");
      let modifier = null;
      if (lastSlash !== -1) {
        modifier = path.slice(lastSlash + 1).trim();
        path = path.slice(0, lastSlash).trim();
      }
      let resolvedValue = (() => {
        let keypath = toKeyPath(path);
        let [cssValue, options] = readFromCss(designSystem.theme, keypath);
        let configValue = resolveValue(get(configTheme() ?? {}, keypath) ?? null);
        if (typeof configValue === "string") {
          configValue = configValue.replace("<alpha-value>", "1");
        }
        if (typeof cssValue !== "object") {
          if (typeof options !== "object" && options & 4 /* DEFAULT */) {
            return configValue ?? cssValue;
          }
          return cssValue;
        }
        if (configValue !== null && typeof configValue === "object" && !Array.isArray(configValue)) {
          let configValueCopy = (
            // We want to make sure that we don't mutate the original config
            // value. Ideally we use `structuredClone` here, but it's not possible
            // because it can contain functions.
            deepMerge({}, [configValue], (_, b) => b)
          );
          if (cssValue === null && Object.hasOwn(configValue, "__CSS_VALUES__")) {
            let localCssValue = {};
            for (let key in configValue.__CSS_VALUES__) {
              localCssValue[key] = configValue[key];
              delete configValueCopy[key];
            }
            cssValue = localCssValue;
          }
          for (let key in cssValue) {
            if (key === "__CSS_VALUES__") continue;
            if (configValue?.__CSS_VALUES__?.[key] & 4 /* DEFAULT */ && get(configValueCopy, key.split("-")) !== void 0) {
              continue;
            }
            configValueCopy[unescape(key)] = cssValue[key];
          }
          return configValueCopy;
        }
        if (Array.isArray(cssValue) && Array.isArray(options) && Array.isArray(configValue)) {
          let base2 = cssValue[0];
          let extra = cssValue[1];
          if (options[0] & 4 /* DEFAULT */) {
            base2 = configValue[0] ?? base2;
          }
          for (let key of Object.keys(extra)) {
            if (options[1][key] & 4 /* DEFAULT */) {
              extra[key] = configValue[1][key] ?? extra[key];
            }
          }
          return [base2, extra];
        }
        if (keypath.length > 1 && cssValue !== null && typeof cssValue === "object" && !Array.isArray(cssValue) && "DEFAULT" in cssValue) {
          return cssValue.DEFAULT;
        }
        return cssValue ?? configValue;
      })();
      if (modifier && typeof resolvedValue === "string") {
        resolvedValue = withAlpha(resolvedValue, modifier);
      }
      return resolvedValue ?? defaultValue;
    };
  }
  function readFromCss(theme2, path) {
    if (path.length === 1 && path[0].startsWith("--")) {
      return [theme2.get([path[0]]), theme2.getOptions(path[0])];
    }
    let themeKey = keyPathToCssProperty(path);
    let map = /* @__PURE__ */ new Map();
    let nested = new DefaultMap(
      () => /* @__PURE__ */ new Map()
    );
    let ns = theme2.namespace(`--${themeKey}`);
    if (ns.size === 0) {
      return [null, 0 /* NONE */];
    }
    let options = /* @__PURE__ */ new Map();
    for (let [key, value2] of ns) {
      if (!key || !key.includes("--")) {
        map.set(key, value2);
        options.set(key, theme2.getOptions(!key ? `--${themeKey}` : `--${themeKey}-${key}`));
        continue;
      }
      let nestedIndex = key.indexOf("--");
      let mainKey = key.slice(0, nestedIndex);
      let nestedKey = key.slice(nestedIndex + 2);
      nestedKey = nestedKey.replace(/-([a-z])/g, (_, a) => a.toUpperCase());
      nested.get(mainKey === "" ? null : mainKey).set(nestedKey, [value2, theme2.getOptions(`--${themeKey}${key}`)]);
    }
    let baseOptions = theme2.getOptions(`--${themeKey}`);
    for (let [key, extra] of nested) {
      let value2 = map.get(key);
      if (typeof value2 !== "string") continue;
      let extraObj = {};
      let extraOptionsObj = {};
      for (let [nestedKey, [nestedValue, nestedOptions]] of extra) {
        extraObj[nestedKey] = nestedValue;
        extraOptionsObj[nestedKey] = nestedOptions;
      }
      map.set(key, [value2, extraObj]);
      options.set(key, [baseOptions, extraOptionsObj]);
    }
    let obj = {};
    let optionsObj = {};
    for (let [key, value2] of map) {
      set(obj, [key ?? "DEFAULT"], value2);
    }
    for (let [key, value2] of options) {
      set(optionsObj, [key ?? "DEFAULT"], value2);
    }
    if (path[path.length - 1] === "DEFAULT") {
      return [obj?.DEFAULT ?? null, optionsObj.DEFAULT ?? 0 /* NONE */];
    }
    if (path.length > 1 && "DEFAULT" in obj && Object.keys(obj).length === 1) {
      return [obj.DEFAULT, optionsObj.DEFAULT ?? 0 /* NONE */];
    }
    obj.__CSS_VALUES__ = optionsObj;
    return [obj, optionsObj];
  }
  function get(obj, path) {
    for (let i = 0; i < path.length; ++i) {
      let key = path[i];
      if (obj === null || obj === void 0 || typeof obj !== "object" || !Object.hasOwn(obj, key)) {
        if (path[i + 1] === void 0) {
          return void 0;
        }
        path[i + 1] = `${key}-${path[i + 1]}`;
        continue;
      }
      obj = obj[key];
    }
    return obj;
  }
  function set(obj, path, value2) {
    for (let key of path.slice(0, -1)) {
      if (obj[key] === void 0) {
        obj[key] = {};
      }
      obj = obj[key];
    }
    obj[path[path.length - 1]] = value2;
  }

  // ../tailwindcss/packages/tailwindcss/src/compat/plugin-api.ts
  var IS_VALID_UTILITY_NAME = /^[a-z@][a-zA-Z0-9/%._-]*$/;
  function buildPluginApi({
    designSystem,
    ast,
    resolvedConfig,
    featuresRef,
    referenceMode,
    src
  }) {
    let api = {
      addBase(css) {
        if (referenceMode) return;
        let baseNodes = objectToAst(css);
        featuresRef.current |= substituteFunctions(baseNodes, designSystem);
        let rule2 = atRule("@layer", "base", baseNodes);
        walk([rule2], (node) => {
          node.src = src;
        });
        ast.push(rule2);
      },
      addVariant(name, variant) {
        if (!IS_VALID_VARIANT_NAME.test(name)) {
          throw new Error(
            `\`addVariant('${name}')\` defines an invalid variant name. Variants should only contain alphanumeric, dashes, or underscore characters and start with a lowercase letter or number.`
          );
        }
        if (typeof variant === "string") {
          if (variant.includes(":merge(")) return;
        } else if (Array.isArray(variant)) {
          if (variant.some((v) => v.includes(":merge("))) return;
        } else if (typeof variant === "object") {
          let keyIncludes2 = function(object, search) {
            return Object.entries(object).some(
              ([key, value2]) => key.includes(search) || typeof value2 === "object" && keyIncludes2(value2, search)
            );
          };
          var keyIncludes = keyIncludes2;
          if (keyIncludes2(variant, ":merge(")) return;
        }
        if (typeof variant === "string" || Array.isArray(variant)) {
          designSystem.variants.static(
            name,
            (r) => {
              r.nodes = parseVariantValue(variant, r.nodes);
            },
            {
              compounds: compoundsForSelectors(typeof variant === "string" ? [variant] : variant)
            }
          );
        } else if (typeof variant === "object") {
          designSystem.variants.fromAst(name, objectToAst(variant), designSystem);
        }
      },
      matchVariant(name, fn, options) {
        function resolveVariantValue(value2, modifier, nodes) {
          let resolved = fn(value2, { modifier: modifier?.value ?? null });
          return parseVariantValue(resolved, nodes);
        }
        try {
          let sample = fn("a", { modifier: null });
          if (typeof sample === "string" && sample.includes(":merge(")) {
            return;
          } else if (Array.isArray(sample) && sample.some((r) => r.includes(":merge("))) {
            return;
          }
        } catch {
        }
        let defaultOptionKeys = Object.keys(options?.values ?? {});
        designSystem.variants.group(
          () => {
            designSystem.variants.functional(name, (ruleNodes, variant) => {
              if (!variant.value) {
                if (options?.values && "DEFAULT" in options.values) {
                  ruleNodes.nodes = resolveVariantValue(
                    options.values.DEFAULT,
                    variant.modifier,
                    ruleNodes.nodes
                  );
                  return;
                }
                return null;
              }
              if (variant.value.kind === "arbitrary") {
                ruleNodes.nodes = resolveVariantValue(
                  variant.value.value,
                  variant.modifier,
                  ruleNodes.nodes
                );
              } else if (variant.value.kind === "named" && options?.values) {
                if (!Object.hasOwn(options.values, variant.value.value)) {
                  return null;
                }
                let defaultValue = options.values[variant.value.value];
                if (typeof defaultValue !== "string") {
                  return null;
                }
                ruleNodes.nodes = resolveVariantValue(defaultValue, variant.modifier, ruleNodes.nodes);
              } else {
                return null;
              }
            });
          },
          (a, z) => {
            if (a.kind !== "functional" || z.kind !== "functional") {
              return 0;
            }
            let aValueKey = a.value ? a.value.value : "DEFAULT";
            let zValueKey = z.value ? z.value.value : "DEFAULT";
            let aValue = (options?.values && Object.hasOwn(options.values, aValueKey) ? options.values[aValueKey] : void 0) ?? aValueKey;
            let zValue = (options?.values && Object.hasOwn(options.values, zValueKey) ? options.values[zValueKey] : void 0) ?? zValueKey;
            if (options && typeof options.sort === "function") {
              return options.sort(
                { value: aValue, modifier: a.modifier?.value ?? null },
                { value: zValue, modifier: z.modifier?.value ?? null }
              );
            }
            let aOrder = defaultOptionKeys.indexOf(aValueKey);
            let zOrder = defaultOptionKeys.indexOf(zValueKey);
            aOrder = aOrder === -1 ? defaultOptionKeys.length : aOrder;
            zOrder = zOrder === -1 ? defaultOptionKeys.length : zOrder;
            if (aOrder !== zOrder) return aOrder - zOrder;
            return aValue < zValue ? -1 : 1;
          }
        );
        designSystem.variants.suggest(
          name,
          () => Object.keys(options?.values ?? {}).filter((v) => v !== "DEFAULT")
        );
      },
      addUtilities(utilities2) {
        utilities2 = Array.isArray(utilities2) ? utilities2 : [utilities2];
        let entries = utilities2.flatMap((u) => Object.entries(u));
        entries = entries.flatMap(
          ([name, css]) => segment(name, ",").map((selector2) => [selector2.trim(), css])
        );
        let utils = new DefaultMap(() => []);
        for (let [name, css] of entries) {
          if (name.startsWith("@keyframes ")) {
            if (!referenceMode) {
              let keyframes = rule(name, objectToAst(css));
              walk([keyframes], (node) => {
                node.src = src;
              });
              ast.push(keyframes);
            }
            continue;
          }
          let selectorAst = parse(name);
          let foundValidUtility = false;
          walk(selectorAst, (node) => {
            if (node.kind === "selector" && node.value[0] === "." && IS_VALID_UTILITY_NAME.test(node.value.slice(1))) {
              let value2 = node.value;
              node.value = "&";
              let selector2 = toCss(selectorAst);
              let className = value2.slice(1);
              let contents = selector2 === "&" ? objectToAst(css) : [rule(selector2, objectToAst(css))];
              utils.get(className).push(...contents);
              foundValidUtility = true;
              node.value = value2;
              return;
            }
            if (node.kind === "function" && (node.value === ":not" || // A class inside `:nth-child(… of <selector>)` is part of the
            // condition, not a utility being defined.
            node.value === ":nth-child" || node.value === ":nth-last-child")) {
              return WalkAction.Skip;
            }
          });
          if (!foundValidUtility) {
            throw new Error(
              `\`addUtilities({ '${name}' : \u2026 })\` defines an invalid utility selector. Utilities must be a single class name and start with a lowercase letter, eg. \`.scrollbar-none\`.`
            );
          }
        }
        for (let [className, ast2] of utils) {
          if (designSystem.theme.prefix) {
            walk(ast2, (node) => {
              if (node.kind === "rule") {
                let selectorAst = parse(node.selector);
                walk(selectorAst, (node2) => {
                  if (node2.kind === "selector" && node2.value[0] === ".") {
                    node2.value = `.${designSystem.theme.prefix}\\:${node2.value.slice(1)}`;
                  }
                });
                node.selector = toCss(selectorAst);
              }
            });
          }
          designSystem.utilities.static(className, (candidate) => {
            let clonedAst = ast2.map(cloneAstNode);
            replaceNestedClassNameReferences(clonedAst, className, candidate.raw);
            featuresRef.current |= substituteAtApply(clonedAst, designSystem);
            return clonedAst;
          });
        }
      },
      matchUtilities(utilities2, options) {
        let types = options?.type ? Array.isArray(options?.type) ? options.type : [options.type] : ["any"];
        for (let [name, fn] of Object.entries(utilities2)) {
          let compileFn2 = function({ negative }) {
            return (candidate) => {
              if (candidate.value?.kind === "arbitrary" && types.length > 0 && !types.includes("any")) {
                if (candidate.value.dataType && !types.includes(candidate.value.dataType)) {
                  return;
                }
                if (!candidate.value.dataType && !inferDataType(candidate.value.value, types)) {
                  return;
                }
              }
              let isColor2 = types.includes("color");
              let value2 = null;
              let ignoreModifier = false;
              {
                let values = options?.values ?? {};
                if (isColor2) {
                  values = Object.assign(
                    {
                      inherit: "inherit",
                      transparent: "transparent",
                      current: "currentcolor"
                    },
                    values
                  );
                }
                if (!candidate.value) {
                  value2 = values.DEFAULT ?? null;
                } else if (candidate.value.kind === "arbitrary") {
                  value2 = candidate.value.value;
                } else if (candidate.value.fraction && Object.hasOwn(values, candidate.value.fraction)) {
                  value2 = values[candidate.value.fraction];
                  ignoreModifier = true;
                } else if (Object.hasOwn(values, candidate.value.value)) {
                  value2 = values[candidate.value.value];
                } else if (values.__BARE_VALUE__) {
                  value2 = values.__BARE_VALUE__(candidate.value) ?? null;
                  ignoreModifier = (candidate.value.fraction !== null && value2?.includes("/")) ?? false;
                }
              }
              if (value2 === null) return;
              let modifier;
              {
                let modifiers = options?.modifiers ?? null;
                if (!candidate.modifier) {
                  modifier = null;
                } else if (modifiers === "any" || candidate.modifier.kind === "arbitrary") {
                  modifier = candidate.modifier.value;
                } else if (modifiers && Object.hasOwn(modifiers, candidate.modifier.value)) {
                  modifier = modifiers[candidate.modifier.value];
                } else if (isColor2 && !Number.isNaN(Number(candidate.modifier.value))) {
                  modifier = `${candidate.modifier.value}%`;
                } else {
                  modifier = null;
                }
              }
              if (candidate.modifier && modifier === null && !ignoreModifier) {
                return candidate.value?.kind === "arbitrary" ? null : void 0;
              }
              if (isColor2 && modifier !== null) {
                value2 = withAlpha(value2, modifier);
              }
              if (negative) {
                value2 = `calc(${value2} * -1)`;
              }
              let ast2 = objectToAst(fn(value2, { modifier }));
              replaceNestedClassNameReferences(ast2, name, candidate.raw);
              featuresRef.current |= substituteAtApply(ast2, designSystem);
              return ast2;
            };
          };
          var compileFn = compileFn2;
          if (!IS_VALID_UTILITY_NAME.test(name)) {
            throw new Error(
              `\`matchUtilities({ '${name}' : \u2026 })\` defines an invalid utility name. Utilities should be alphanumeric and start with a lowercase letter, eg. \`scrollbar\`.`
            );
          }
          if (options?.supportsNegativeValues) {
            designSystem.utilities.functional(`-${name}`, compileFn2({ negative: true }), { types });
          }
          designSystem.utilities.functional(name, compileFn2({ negative: false }), { types });
          designSystem.utilities.suggest(name, () => {
            let values = options?.values ?? {};
            let valueKeys = new Set(Object.keys(values));
            valueKeys.delete("__BARE_VALUE__");
            valueKeys.delete("__CSS_VALUES__");
            if (valueKeys.has("DEFAULT")) {
              valueKeys.delete("DEFAULT");
              valueKeys.add(null);
            }
            let modifiers = options?.modifiers ?? {};
            let modifierKeys = modifiers === "any" ? [] : Object.keys(modifiers);
            return [
              {
                supportsNegative: options?.supportsNegativeValues ?? false,
                values: Array.from(valueKeys),
                modifiers: modifierKeys
              }
            ];
          });
        }
      },
      addComponents(components2, options) {
        this.addUtilities(components2, options);
      },
      matchComponents(components2, options) {
        this.matchUtilities(components2, options);
      },
      theme: createThemeFn(
        designSystem,
        () => resolvedConfig.theme ?? {},
        (value2) => value2
      ),
      prefix(className) {
        return className;
      },
      config(path, defaultValue) {
        let obj = resolvedConfig;
        if (!path) return obj;
        let keypath = toKeyPath(path);
        for (let i = 0; i < keypath.length; ++i) {
          let key = keypath[i];
          if (obj[key] === void 0) return defaultValue;
          obj = obj[key];
        }
        return obj ?? defaultValue;
      }
    };
    api.addComponents = api.addComponents.bind(api);
    api.matchComponents = api.matchComponents.bind(api);
    return api;
  }
  function objectToAst(rules) {
    let ast = [];
    rules = Array.isArray(rules) ? rules : [rules];
    let entries = rules.flatMap((rule2) => Object.entries(rule2));
    for (let [name, value2] of entries) {
      if (value2 === null || value2 === void 0) continue;
      if (value2 === false) continue;
      if (typeof value2 !== "object") {
        if (!name.startsWith("--")) {
          if (value2 === "@slot") {
            ast.push(rule(name, [atRule("@slot")]));
            continue;
          }
          name = name.replace(/([A-Z])/g, "-$1").toLowerCase();
        }
        ast.push(decl(name, String(value2)));
      } else if (Array.isArray(value2)) {
        for (let item of value2) {
          if (typeof item === "string") {
            ast.push(decl(name, item));
          } else {
            ast.push(rule(name, objectToAst(item)));
          }
        }
      } else {
        ast.push(rule(name, objectToAst(value2)));
      }
    }
    return ast;
  }
  function parseVariantValue(resolved, nodes) {
    let resolvedArray = typeof resolved === "string" ? [resolved] : resolved;
    return resolvedArray.flatMap((r) => {
      if (r.trim().endsWith("}")) {
        let usesAtScope = r.includes("@scope");
        let updatedCSS = r.replace("}", "{@slot}}");
        let ast = parse2(updatedCSS);
        if (usesAtScope) {
          substituteAtSlot(ast, [context({ source: "user" }, nodes)]);
          return context({ source: "variant" }, ast);
        }
        substituteAtSlot(ast, nodes);
        return ast;
      } else {
        let node = rule(r, nodes);
        if (node.kind === "at-rule" && node.name === "@scope") {
          node.nodes = [context({ source: "user" }, nodes)];
          return context({ source: "variant" }, [node]);
        }
        return node;
      }
    });
  }
  function replaceNestedClassNameReferences(ast, utilityName, rawCandidate) {
    walk(ast, (node) => {
      if (node.kind === "rule") {
        let selectorAst = parse(node.selector);
        walk(selectorAst, (node2) => {
          if (node2.kind === "selector" && node2.value === `.${utilityName}`) {
            node2.value = `.${escape(rawCandidate)}`;
          }
        });
        node.selector = toCss(selectorAst);
      }
    });
  }

  // ../tailwindcss/packages/tailwindcss/src/compat/apply-keyframes-to-theme.ts
  function applyKeyframesToTheme(designSystem, resolvedConfig) {
    for (let rule2 of keyframesToRules(resolvedConfig)) {
      designSystem.theme.addKeyframes(rule2);
    }
  }
  function keyframesToRules(resolvedConfig) {
    let rules = [];
    if ("keyframes" in resolvedConfig.theme) {
      for (let [name, keyframe] of Object.entries(resolvedConfig.theme.keyframes)) {
        rules.push(atRule("@keyframes", name, objectToAst(keyframe)));
      }
    }
    return rules;
  }

  // ../tailwindcss/packages/tailwindcss/src/compat/colors.ts
  var colors_default = {
    inherit: "inherit",
    current: "currentcolor",
    transparent: "transparent",
    black: "#000",
    white: "#fff",
    slate: {
      "50": "oklch(98.4% 0.003 247.858)",
      "100": "oklch(96.8% 0.007 247.896)",
      "200": "oklch(92.9% 0.013 255.508)",
      "300": "oklch(86.9% 0.022 252.894)",
      "400": "oklch(70.4% 0.04 256.788)",
      "500": "oklch(55.4% 0.046 257.417)",
      "600": "oklch(44.6% 0.043 257.281)",
      "700": "oklch(37.2% 0.044 257.287)",
      "800": "oklch(27.9% 0.041 260.031)",
      "900": "oklch(20.8% 0.042 265.755)",
      "950": "oklch(12.9% 0.042 264.695)"
    },
    gray: {
      "50": "oklch(98.5% 0.002 247.839)",
      "100": "oklch(96.7% 0.003 264.542)",
      "200": "oklch(92.8% 0.006 264.531)",
      "300": "oklch(87.2% 0.01 258.338)",
      "400": "oklch(70.7% 0.022 261.325)",
      "500": "oklch(55.1% 0.027 264.364)",
      "600": "oklch(44.6% 0.03 256.802)",
      "700": "oklch(37.3% 0.034 259.733)",
      "800": "oklch(27.8% 0.033 256.848)",
      "900": "oklch(21% 0.034 264.665)",
      "950": "oklch(13% 0.028 261.692)"
    },
    zinc: {
      "50": "oklch(98.5% 0 none)",
      "100": "oklch(96.7% 0.001 286.375)",
      "200": "oklch(92% 0.004 286.32)",
      "300": "oklch(87.1% 0.006 286.286)",
      "400": "oklch(70.5% 0.015 286.067)",
      "500": "oklch(55.2% 0.016 285.938)",
      "600": "oklch(44.2% 0.017 285.786)",
      "700": "oklch(37% 0.013 285.805)",
      "800": "oklch(27.4% 0.006 286.033)",
      "900": "oklch(21% 0.006 285.885)",
      "950": "oklch(14.1% 0.005 285.823)"
    },
    neutral: {
      "50": "oklch(98.5% 0 none)",
      "100": "oklch(97% 0 none)",
      "200": "oklch(92.2% 0 none)",
      "300": "oklch(87% 0 none)",
      "400": "oklch(70.8% 0 none)",
      "500": "oklch(55.6% 0 none)",
      "600": "oklch(43.9% 0 none)",
      "700": "oklch(37.1% 0 none)",
      "800": "oklch(26.9% 0 none)",
      "900": "oklch(20.5% 0 none)",
      "950": "oklch(14.5% 0 none)"
    },
    stone: {
      "50": "oklch(98.5% 0.001 106.423)",
      "100": "oklch(97% 0.001 106.424)",
      "200": "oklch(92.3% 0.003 48.717)",
      "300": "oklch(86.9% 0.005 56.366)",
      "400": "oklch(70.9% 0.01 56.259)",
      "500": "oklch(55.3% 0.013 58.071)",
      "600": "oklch(44.4% 0.011 73.639)",
      "700": "oklch(37.4% 0.01 67.558)",
      "800": "oklch(26.8% 0.007 34.298)",
      "900": "oklch(21.6% 0.006 56.043)",
      "950": "oklch(14.7% 0.004 49.25)"
    },
    mauve: {
      "50": "oklch(98.5% 0 none)",
      "100": "oklch(96% 0.003 325.6)",
      "200": "oklch(92.2% 0.005 325.62)",
      "300": "oklch(86.5% 0.012 325.68)",
      "400": "oklch(71.1% 0.019 323.02)",
      "500": "oklch(54.2% 0.034 322.5)",
      "600": "oklch(43.5% 0.029 321.78)",
      "700": "oklch(36.4% 0.029 323.89)",
      "800": "oklch(26.3% 0.024 320.12)",
      "900": "oklch(21.2% 0.019 322.12)",
      "950": "oklch(14.5% 0.008 326)"
    },
    olive: {
      "50": "oklch(98.8% 0.003 106.5)",
      "100": "oklch(96.6% 0.005 106.5)",
      "200": "oklch(93% 0.007 106.5)",
      "300": "oklch(88% 0.011 106.6)",
      "400": "oklch(73.7% 0.021 106.9)",
      "500": "oklch(58% 0.031 107.3)",
      "600": "oklch(46.6% 0.025 107.3)",
      "700": "oklch(39.4% 0.023 107.4)",
      "800": "oklch(28.6% 0.016 107.4)",
      "900": "oklch(22.8% 0.013 107.4)",
      "950": "oklch(15.3% 0.006 107.1)"
    },
    mist: {
      "50": "oklch(98.7% 0.002 197.1)",
      "100": "oklch(96.3% 0.002 197.1)",
      "200": "oklch(92.5% 0.005 214.3)",
      "300": "oklch(87.2% 0.007 219.6)",
      "400": "oklch(72.3% 0.014 214.4)",
      "500": "oklch(56% 0.021 213.5)",
      "600": "oklch(45% 0.017 213.2)",
      "700": "oklch(37.8% 0.015 216)",
      "800": "oklch(27.5% 0.011 216.9)",
      "900": "oklch(21.8% 0.008 223.9)",
      "950": "oklch(14.8% 0.004 228.8)"
    },
    taupe: {
      "50": "oklch(98.6% 0.002 67.8)",
      "100": "oklch(96% 0.002 17.2)",
      "200": "oklch(92.2% 0.005 34.3)",
      "300": "oklch(86.8% 0.007 39.5)",
      "400": "oklch(71.4% 0.014 41.2)",
      "500": "oklch(54.7% 0.021 43.1)",
      "600": "oklch(43.8% 0.017 39.3)",
      "700": "oklch(36.7% 0.016 35.7)",
      "800": "oklch(26.8% 0.011 36.5)",
      "900": "oklch(21.4% 0.009 43.1)",
      "950": "oklch(14.7% 0.004 49.3)"
    },
    red: {
      "50": "oklch(97.1% 0.013 17.38)",
      "100": "oklch(93.6% 0.032 17.717)",
      "200": "oklch(88.5% 0.062 18.334)",
      "300": "oklch(80.8% 0.114 19.571)",
      "400": "oklch(70.4% 0.191 22.216)",
      "500": "oklch(63.7% 0.237 25.331)",
      "600": "oklch(57.7% 0.245 27.325)",
      "700": "oklch(50.5% 0.213 27.518)",
      "800": "oklch(44.4% 0.177 26.899)",
      "900": "oklch(39.6% 0.141 25.723)",
      "950": "oklch(25.8% 0.092 26.042)"
    },
    orange: {
      "50": "oklch(98% 0.016 73.684)",
      "100": "oklch(95.4% 0.038 75.164)",
      "200": "oklch(90.1% 0.076 70.697)",
      "300": "oklch(83.7% 0.128 66.29)",
      "400": "oklch(75% 0.183 55.934)",
      "500": "oklch(70.5% 0.213 47.604)",
      "600": "oklch(64.6% 0.222 41.116)",
      "700": "oklch(55.3% 0.195 38.402)",
      "800": "oklch(47% 0.157 37.304)",
      "900": "oklch(40.8% 0.123 38.172)",
      "950": "oklch(26.6% 0.079 36.259)"
    },
    amber: {
      "50": "oklch(98.7% 0.022 95.277)",
      "100": "oklch(96.2% 0.059 95.617)",
      "200": "oklch(92.4% 0.12 95.746)",
      "300": "oklch(87.9% 0.169 91.605)",
      "400": "oklch(82.8% 0.189 84.429)",
      "500": "oklch(76.9% 0.188 70.08)",
      "600": "oklch(66.6% 0.179 58.318)",
      "700": "oklch(55.5% 0.163 48.998)",
      "800": "oklch(47.3% 0.137 46.201)",
      "900": "oklch(41.4% 0.112 45.904)",
      "950": "oklch(27.9% 0.077 45.635)"
    },
    yellow: {
      "50": "oklch(98.7% 0.026 102.212)",
      "100": "oklch(97.3% 0.071 103.193)",
      "200": "oklch(94.5% 0.129 101.54)",
      "300": "oklch(90.5% 0.182 98.111)",
      "400": "oklch(85.2% 0.199 91.936)",
      "500": "oklch(79.5% 0.184 86.047)",
      "600": "oklch(68.1% 0.162 75.834)",
      "700": "oklch(55.4% 0.135 66.442)",
      "800": "oklch(47.6% 0.114 61.907)",
      "900": "oklch(42.1% 0.095 57.708)",
      "950": "oklch(28.6% 0.066 53.813)"
    },
    lime: {
      "50": "oklch(98.6% 0.031 120.757)",
      "100": "oklch(96.7% 0.067 122.328)",
      "200": "oklch(93.8% 0.127 124.321)",
      "300": "oklch(89.7% 0.196 126.665)",
      "400": "oklch(84.1% 0.238 128.85)",
      "500": "oklch(76.8% 0.233 130.85)",
      "600": "oklch(64.8% 0.2 131.684)",
      "700": "oklch(53.2% 0.157 131.589)",
      "800": "oklch(45.3% 0.124 130.933)",
      "900": "oklch(40.5% 0.101 131.063)",
      "950": "oklch(27.4% 0.072 132.109)"
    },
    green: {
      "50": "oklch(98.2% 0.018 155.826)",
      "100": "oklch(96.2% 0.044 156.743)",
      "200": "oklch(92.5% 0.084 155.995)",
      "300": "oklch(87.1% 0.15 154.449)",
      "400": "oklch(79.2% 0.209 151.711)",
      "500": "oklch(72.3% 0.219 149.579)",
      "600": "oklch(62.7% 0.194 149.214)",
      "700": "oklch(52.7% 0.154 150.069)",
      "800": "oklch(44.8% 0.119 151.328)",
      "900": "oklch(39.3% 0.095 152.535)",
      "950": "oklch(26.6% 0.065 152.934)"
    },
    emerald: {
      "50": "oklch(97.9% 0.021 166.113)",
      "100": "oklch(95% 0.052 163.051)",
      "200": "oklch(90.5% 0.093 164.15)",
      "300": "oklch(84.5% 0.143 164.978)",
      "400": "oklch(76.5% 0.177 163.223)",
      "500": "oklch(69.6% 0.17 162.48)",
      "600": "oklch(59.6% 0.145 163.225)",
      "700": "oklch(50.8% 0.118 165.612)",
      "800": "oklch(43.2% 0.095 166.913)",
      "900": "oklch(37.8% 0.077 168.94)",
      "950": "oklch(26.2% 0.051 172.552)"
    },
    teal: {
      "50": "oklch(98.4% 0.014 180.72)",
      "100": "oklch(95.3% 0.051 180.801)",
      "200": "oklch(91% 0.096 180.426)",
      "300": "oklch(85.5% 0.138 181.071)",
      "400": "oklch(77.7% 0.152 181.912)",
      "500": "oklch(70.4% 0.14 182.503)",
      "600": "oklch(60% 0.118 184.704)",
      "700": "oklch(51.1% 0.096 186.391)",
      "800": "oklch(43.7% 0.078 188.216)",
      "900": "oklch(38.6% 0.063 188.416)",
      "950": "oklch(27.7% 0.046 192.524)"
    },
    cyan: {
      "50": "oklch(98.4% 0.019 200.873)",
      "100": "oklch(95.6% 0.045 203.388)",
      "200": "oklch(91.7% 0.08 205.041)",
      "300": "oklch(86.5% 0.127 207.078)",
      "400": "oklch(78.9% 0.154 211.53)",
      "500": "oklch(71.5% 0.143 215.221)",
      "600": "oklch(60.9% 0.126 221.723)",
      "700": "oklch(52% 0.105 223.128)",
      "800": "oklch(45% 0.085 224.283)",
      "900": "oklch(39.8% 0.07 227.392)",
      "950": "oklch(30.2% 0.056 229.695)"
    },
    sky: {
      "50": "oklch(97.7% 0.013 236.62)",
      "100": "oklch(95.1% 0.026 236.824)",
      "200": "oklch(90.1% 0.058 230.902)",
      "300": "oklch(82.8% 0.111 230.318)",
      "400": "oklch(74.6% 0.16 232.661)",
      "500": "oklch(68.5% 0.169 237.323)",
      "600": "oklch(58.8% 0.158 241.966)",
      "700": "oklch(50% 0.134 242.749)",
      "800": "oklch(44.3% 0.11 240.79)",
      "900": "oklch(39.1% 0.09 240.876)",
      "950": "oklch(29.3% 0.066 243.157)"
    },
    blue: {
      "50": "oklch(97% 0.014 254.604)",
      "100": "oklch(93.2% 0.032 255.585)",
      "200": "oklch(88.2% 0.059 254.128)",
      "300": "oklch(80.9% 0.105 251.813)",
      "400": "oklch(70.7% 0.165 254.624)",
      "500": "oklch(62.3% 0.214 259.815)",
      "600": "oklch(54.6% 0.245 262.881)",
      "700": "oklch(48.8% 0.243 264.376)",
      "800": "oklch(42.4% 0.199 265.638)",
      "900": "oklch(37.9% 0.146 265.522)",
      "950": "oklch(28.2% 0.091 267.935)"
    },
    indigo: {
      "50": "oklch(96.2% 0.018 272.314)",
      "100": "oklch(93% 0.034 272.788)",
      "200": "oklch(87% 0.065 274.039)",
      "300": "oklch(78.5% 0.115 274.713)",
      "400": "oklch(67.3% 0.182 276.935)",
      "500": "oklch(58.5% 0.233 277.117)",
      "600": "oklch(51.1% 0.262 276.966)",
      "700": "oklch(45.7% 0.24 277.023)",
      "800": "oklch(39.8% 0.195 277.366)",
      "900": "oklch(35.9% 0.144 278.697)",
      "950": "oklch(25.7% 0.09 281.288)"
    },
    violet: {
      "50": "oklch(96.9% 0.016 293.756)",
      "100": "oklch(94.3% 0.029 294.588)",
      "200": "oklch(89.4% 0.057 293.283)",
      "300": "oklch(81.1% 0.111 293.571)",
      "400": "oklch(70.2% 0.183 293.541)",
      "500": "oklch(60.6% 0.25 292.717)",
      "600": "oklch(54.1% 0.281 293.009)",
      "700": "oklch(49.1% 0.27 292.581)",
      "800": "oklch(43.2% 0.232 292.759)",
      "900": "oklch(38% 0.189 293.745)",
      "950": "oklch(28.3% 0.141 291.089)"
    },
    purple: {
      "50": "oklch(97.7% 0.014 308.299)",
      "100": "oklch(94.6% 0.033 307.174)",
      "200": "oklch(90.2% 0.063 306.703)",
      "300": "oklch(82.7% 0.119 306.383)",
      "400": "oklch(71.4% 0.203 305.504)",
      "500": "oklch(62.7% 0.265 303.9)",
      "600": "oklch(55.8% 0.288 302.321)",
      "700": "oklch(49.6% 0.265 301.924)",
      "800": "oklch(43.8% 0.218 303.724)",
      "900": "oklch(38.1% 0.176 304.987)",
      "950": "oklch(29.1% 0.149 302.717)"
    },
    fuchsia: {
      "50": "oklch(97.7% 0.017 320.058)",
      "100": "oklch(95.2% 0.037 318.852)",
      "200": "oklch(90.3% 0.076 319.62)",
      "300": "oklch(83.3% 0.145 321.434)",
      "400": "oklch(74% 0.238 322.16)",
      "500": "oklch(66.7% 0.295 322.15)",
      "600": "oklch(59.1% 0.293 322.896)",
      "700": "oklch(51.8% 0.253 323.949)",
      "800": "oklch(45.2% 0.211 324.591)",
      "900": "oklch(40.1% 0.17 325.612)",
      "950": "oklch(29.3% 0.136 325.661)"
    },
    pink: {
      "50": "oklch(97.1% 0.014 343.198)",
      "100": "oklch(94.8% 0.028 342.258)",
      "200": "oklch(89.9% 0.061 343.231)",
      "300": "oklch(82.3% 0.12 346.018)",
      "400": "oklch(71.8% 0.202 349.761)",
      "500": "oklch(65.6% 0.241 354.308)",
      "600": "oklch(59.2% 0.249 0.584)",
      "700": "oklch(52.5% 0.223 3.958)",
      "800": "oklch(45.9% 0.187 3.815)",
      "900": "oklch(40.8% 0.153 2.432)",
      "950": "oklch(28.4% 0.109 3.907)"
    },
    rose: {
      "50": "oklch(96.9% 0.015 12.422)",
      "100": "oklch(94.1% 0.03 12.58)",
      "200": "oklch(89.2% 0.058 10.001)",
      "300": "oklch(81% 0.117 11.638)",
      "400": "oklch(71.2% 0.194 13.428)",
      "500": "oklch(64.5% 0.246 16.439)",
      "600": "oklch(58.6% 0.253 17.585)",
      "700": "oklch(51.4% 0.222 16.935)",
      "800": "oklch(45.5% 0.188 13.697)",
      "900": "oklch(41% 0.159 10.272)",
      "950": "oklch(27.1% 0.105 12.094)"
    }
  };

  // ../tailwindcss/packages/tailwindcss/src/compat/default-theme.ts
  function bareValues(fn) {
    return {
      // Ideally this would be a Symbol but some of the ecosystem assumes object with
      // string / number keys for example by using `Object.entries()` which means that
      // the function that handles the bare value would be lost
      __BARE_VALUE__: fn
    };
  }
  var bareIntegers = bareValues((value2) => {
    if (isPositiveInteger(value2.value)) {
      return value2.value;
    }
  });
  var barePercentages = bareValues((value2) => {
    if (isPositiveInteger(value2.value)) {
      return `${value2.value}%`;
    }
  });
  var barePixels = bareValues((value2) => {
    if (isPositiveInteger(value2.value)) {
      return `${value2.value}px`;
    }
  });
  var bareMilliseconds = bareValues((value2) => {
    if (isPositiveInteger(value2.value)) {
      return `${value2.value}ms`;
    }
  });
  var bareDegrees = bareValues((value2) => {
    if (isPositiveInteger(value2.value)) {
      return `${value2.value}deg`;
    }
  });
  var bareAspectRatio = bareValues((value2) => {
    if (value2.fraction === null) return;
    let [lhs, rhs] = segment(value2.fraction, "/");
    if (!isPositiveInteger(lhs) || !isPositiveInteger(rhs)) return;
    return value2.fraction;
  });
  var bareRepeatValues = bareValues((value2) => {
    if (isPositiveInteger(Number(value2.value))) {
      return `repeat(${value2.value}, minmax(0, 1fr))`;
    }
  });
  var default_theme_default = {
    accentColor: ({ theme: theme2 }) => theme2("colors"),
    animation: {
      none: "none",
      spin: "spin 1s linear infinite",
      ping: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
      pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      bounce: "bounce 1s infinite"
    },
    aria: {
      busy: 'busy="true"',
      checked: 'checked="true"',
      disabled: 'disabled="true"',
      expanded: 'expanded="true"',
      hidden: 'hidden="true"',
      pressed: 'pressed="true"',
      readonly: 'readonly="true"',
      required: 'required="true"',
      selected: 'selected="true"'
    },
    aspectRatio: {
      auto: "auto",
      square: "1 / 1",
      video: "16 / 9",
      ...bareAspectRatio
    },
    backdropBlur: ({ theme: theme2 }) => theme2("blur"),
    backdropBrightness: ({ theme: theme2 }) => ({
      ...theme2("brightness"),
      ...barePercentages
    }),
    backdropContrast: ({ theme: theme2 }) => ({
      ...theme2("contrast"),
      ...barePercentages
    }),
    backdropGrayscale: ({ theme: theme2 }) => ({
      ...theme2("grayscale"),
      ...barePercentages
    }),
    backdropHueRotate: ({ theme: theme2 }) => ({
      ...theme2("hueRotate"),
      ...bareDegrees
    }),
    backdropInvert: ({ theme: theme2 }) => ({
      ...theme2("invert"),
      ...barePercentages
    }),
    backdropOpacity: ({ theme: theme2 }) => ({
      ...theme2("opacity"),
      ...barePercentages
    }),
    backdropSaturate: ({ theme: theme2 }) => ({
      ...theme2("saturate"),
      ...barePercentages
    }),
    backdropSepia: ({ theme: theme2 }) => ({
      ...theme2("sepia"),
      ...barePercentages
    }),
    backgroundColor: ({ theme: theme2 }) => theme2("colors"),
    backgroundImage: {
      none: "none",
      "gradient-to-t": "linear-gradient(to top, var(--tw-gradient-stops))",
      "gradient-to-tr": "linear-gradient(to top right, var(--tw-gradient-stops))",
      "gradient-to-r": "linear-gradient(to right, var(--tw-gradient-stops))",
      "gradient-to-br": "linear-gradient(to bottom right, var(--tw-gradient-stops))",
      "gradient-to-b": "linear-gradient(to bottom, var(--tw-gradient-stops))",
      "gradient-to-bl": "linear-gradient(to bottom left, var(--tw-gradient-stops))",
      "gradient-to-l": "linear-gradient(to left, var(--tw-gradient-stops))",
      "gradient-to-tl": "linear-gradient(to top left, var(--tw-gradient-stops))"
    },
    backgroundOpacity: ({ theme: theme2 }) => theme2("opacity"),
    backgroundPosition: {
      bottom: "bottom",
      center: "center",
      left: "left",
      "left-bottom": "left bottom",
      "left-top": "left top",
      right: "right",
      "right-bottom": "right bottom",
      "right-top": "right top",
      top: "top"
    },
    backgroundSize: {
      auto: "auto",
      cover: "cover",
      contain: "contain"
    },
    blur: {
      0: "0",
      none: "",
      sm: "4px",
      DEFAULT: "8px",
      md: "12px",
      lg: "16px",
      xl: "24px",
      "2xl": "40px",
      "3xl": "64px"
    },
    borderColor: ({ theme: theme2 }) => ({
      DEFAULT: "currentcolor",
      ...theme2("colors")
    }),
    borderOpacity: ({ theme: theme2 }) => theme2("opacity"),
    borderRadius: {
      none: "0px",
      sm: "0.125rem",
      DEFAULT: "0.25rem",
      md: "0.375rem",
      lg: "0.5rem",
      xl: "0.75rem",
      "2xl": "1rem",
      "3xl": "1.5rem",
      full: "9999px"
    },
    borderSpacing: ({ theme: theme2 }) => theme2("spacing"),
    borderWidth: {
      DEFAULT: "1px",
      0: "0px",
      2: "2px",
      4: "4px",
      8: "8px",
      ...barePixels
    },
    boxShadow: {
      sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
      md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
      xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
      "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
      inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
      none: "none"
    },
    boxShadowColor: ({ theme: theme2 }) => theme2("colors"),
    brightness: {
      0: "0",
      50: ".5",
      75: ".75",
      90: ".9",
      95: ".95",
      100: "1",
      105: "1.05",
      110: "1.1",
      125: "1.25",
      150: "1.5",
      200: "2",
      ...barePercentages
    },
    caretColor: ({ theme: theme2 }) => theme2("colors"),
    colors: () => ({ ...colors_default }),
    columns: {
      auto: "auto",
      1: "1",
      2: "2",
      3: "3",
      4: "4",
      5: "5",
      6: "6",
      7: "7",
      8: "8",
      9: "9",
      10: "10",
      11: "11",
      12: "12",
      "3xs": "16rem",
      "2xs": "18rem",
      xs: "20rem",
      sm: "24rem",
      md: "28rem",
      lg: "32rem",
      xl: "36rem",
      "2xl": "42rem",
      "3xl": "48rem",
      "4xl": "56rem",
      "5xl": "64rem",
      "6xl": "72rem",
      "7xl": "80rem",
      ...bareIntegers
    },
    container: {},
    content: {
      none: "none"
    },
    contrast: {
      0: "0",
      50: ".5",
      75: ".75",
      100: "1",
      125: "1.25",
      150: "1.5",
      200: "2",
      ...barePercentages
    },
    cursor: {
      auto: "auto",
      default: "default",
      pointer: "pointer",
      wait: "wait",
      text: "text",
      move: "move",
      help: "help",
      "not-allowed": "not-allowed",
      none: "none",
      "context-menu": "context-menu",
      progress: "progress",
      cell: "cell",
      crosshair: "crosshair",
      "vertical-text": "vertical-text",
      alias: "alias",
      copy: "copy",
      "no-drop": "no-drop",
      grab: "grab",
      grabbing: "grabbing",
      "all-scroll": "all-scroll",
      "col-resize": "col-resize",
      "row-resize": "row-resize",
      "n-resize": "n-resize",
      "e-resize": "e-resize",
      "s-resize": "s-resize",
      "w-resize": "w-resize",
      "ne-resize": "ne-resize",
      "nw-resize": "nw-resize",
      "se-resize": "se-resize",
      "sw-resize": "sw-resize",
      "ew-resize": "ew-resize",
      "ns-resize": "ns-resize",
      "nesw-resize": "nesw-resize",
      "nwse-resize": "nwse-resize",
      "zoom-in": "zoom-in",
      "zoom-out": "zoom-out"
    },
    divideColor: ({ theme: theme2 }) => theme2("borderColor"),
    divideOpacity: ({ theme: theme2 }) => theme2("borderOpacity"),
    divideWidth: ({ theme: theme2 }) => ({
      ...theme2("borderWidth"),
      ...barePixels
    }),
    dropShadow: {
      sm: "0 1px 1px rgb(0 0 0 / 0.05)",
      DEFAULT: ["0 1px 2px rgb(0 0 0 / 0.1)", "0 1px 1px rgb(0 0 0 / 0.06)"],
      md: ["0 4px 3px rgb(0 0 0 / 0.07)", "0 2px 2px rgb(0 0 0 / 0.06)"],
      lg: ["0 10px 8px rgb(0 0 0 / 0.04)", "0 4px 3px rgb(0 0 0 / 0.1)"],
      xl: ["0 20px 13px rgb(0 0 0 / 0.03)", "0 8px 5px rgb(0 0 0 / 0.08)"],
      "2xl": "0 25px 25px rgb(0 0 0 / 0.15)",
      none: "0 0 #0000"
    },
    fill: ({ theme: theme2 }) => theme2("colors"),
    flex: {
      1: "1 1 0%",
      auto: "1 1 auto",
      initial: "0 1 auto",
      none: "none"
    },
    flexBasis: ({ theme: theme2 }) => ({
      auto: "auto",
      "1/2": "50%",
      "1/3": "33.333333%",
      "2/3": "66.666667%",
      "1/4": "25%",
      "2/4": "50%",
      "3/4": "75%",
      "1/5": "20%",
      "2/5": "40%",
      "3/5": "60%",
      "4/5": "80%",
      "1/6": "16.666667%",
      "2/6": "33.333333%",
      "3/6": "50%",
      "4/6": "66.666667%",
      "5/6": "83.333333%",
      "1/12": "8.333333%",
      "2/12": "16.666667%",
      "3/12": "25%",
      "4/12": "33.333333%",
      "5/12": "41.666667%",
      "6/12": "50%",
      "7/12": "58.333333%",
      "8/12": "66.666667%",
      "9/12": "75%",
      "10/12": "83.333333%",
      "11/12": "91.666667%",
      full: "100%",
      ...theme2("spacing")
    }),
    flexGrow: {
      0: "0",
      DEFAULT: "1",
      ...bareIntegers
    },
    flexShrink: {
      0: "0",
      DEFAULT: "1",
      ...bareIntegers
    },
    fontFamily: {
      sans: [
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "Roboto",
        '"Helvetica Neue"',
        '"Noto Sans"',
        "Arial",
        "sans-serif",
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
        '"Noto Color Emoji"'
      ],
      serif: ["ui-serif", "Georgia", "Cambria", '"Times New Roman"', "Times", "serif"],
      mono: [
        "ui-monospace",
        "SFMono-Regular",
        "Menlo",
        "Monaco",
        "Consolas",
        '"Liberation Mono"',
        '"Courier New"',
        "monospace"
      ]
    },
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem" }],
      sm: ["0.875rem", { lineHeight: "1.25rem" }],
      base: ["1rem", { lineHeight: "1.5rem" }],
      lg: ["1.125rem", { lineHeight: "1.75rem" }],
      xl: ["1.25rem", { lineHeight: "1.75rem" }],
      "2xl": ["1.5rem", { lineHeight: "2rem" }],
      "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
      "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
      "5xl": ["3rem", { lineHeight: "1" }],
      "6xl": ["3.75rem", { lineHeight: "1" }],
      "7xl": ["4.5rem", { lineHeight: "1" }],
      "8xl": ["6rem", { lineHeight: "1" }],
      "9xl": ["8rem", { lineHeight: "1" }]
    },
    fontWeight: {
      thin: "100",
      extralight: "200",
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
      black: "900"
    },
    gap: ({ theme: theme2 }) => theme2("spacing"),
    gradientColorStops: ({ theme: theme2 }) => theme2("colors"),
    gradientColorStopPositions: {
      "0%": "0%",
      "5%": "5%",
      "10%": "10%",
      "15%": "15%",
      "20%": "20%",
      "25%": "25%",
      "30%": "30%",
      "35%": "35%",
      "40%": "40%",
      "45%": "45%",
      "50%": "50%",
      "55%": "55%",
      "60%": "60%",
      "65%": "65%",
      "70%": "70%",
      "75%": "75%",
      "80%": "80%",
      "85%": "85%",
      "90%": "90%",
      "95%": "95%",
      "100%": "100%",
      ...barePercentages
    },
    grayscale: {
      0: "0",
      DEFAULT: "100%",
      ...barePercentages
    },
    gridAutoColumns: {
      auto: "auto",
      min: "min-content",
      max: "max-content",
      fr: "minmax(0, 1fr)"
    },
    gridAutoRows: {
      auto: "auto",
      min: "min-content",
      max: "max-content",
      fr: "minmax(0, 1fr)"
    },
    gridColumn: {
      auto: "auto",
      "span-1": "span 1 / span 1",
      "span-2": "span 2 / span 2",
      "span-3": "span 3 / span 3",
      "span-4": "span 4 / span 4",
      "span-5": "span 5 / span 5",
      "span-6": "span 6 / span 6",
      "span-7": "span 7 / span 7",
      "span-8": "span 8 / span 8",
      "span-9": "span 9 / span 9",
      "span-10": "span 10 / span 10",
      "span-11": "span 11 / span 11",
      "span-12": "span 12 / span 12",
      "span-full": "1 / -1"
    },
    gridColumnEnd: {
      auto: "auto",
      1: "1",
      2: "2",
      3: "3",
      4: "4",
      5: "5",
      6: "6",
      7: "7",
      8: "8",
      9: "9",
      10: "10",
      11: "11",
      12: "12",
      13: "13",
      ...bareIntegers
    },
    gridColumnStart: {
      auto: "auto",
      1: "1",
      2: "2",
      3: "3",
      4: "4",
      5: "5",
      6: "6",
      7: "7",
      8: "8",
      9: "9",
      10: "10",
      11: "11",
      12: "12",
      13: "13",
      ...bareIntegers
    },
    gridRow: {
      auto: "auto",
      "span-1": "span 1 / span 1",
      "span-2": "span 2 / span 2",
      "span-3": "span 3 / span 3",
      "span-4": "span 4 / span 4",
      "span-5": "span 5 / span 5",
      "span-6": "span 6 / span 6",
      "span-7": "span 7 / span 7",
      "span-8": "span 8 / span 8",
      "span-9": "span 9 / span 9",
      "span-10": "span 10 / span 10",
      "span-11": "span 11 / span 11",
      "span-12": "span 12 / span 12",
      "span-full": "1 / -1"
    },
    gridRowEnd: {
      auto: "auto",
      1: "1",
      2: "2",
      3: "3",
      4: "4",
      5: "5",
      6: "6",
      7: "7",
      8: "8",
      9: "9",
      10: "10",
      11: "11",
      12: "12",
      13: "13",
      ...bareIntegers
    },
    gridRowStart: {
      auto: "auto",
      1: "1",
      2: "2",
      3: "3",
      4: "4",
      5: "5",
      6: "6",
      7: "7",
      8: "8",
      9: "9",
      10: "10",
      11: "11",
      12: "12",
      13: "13",
      ...bareIntegers
    },
    gridTemplateColumns: {
      none: "none",
      subgrid: "subgrid",
      1: "repeat(1, minmax(0, 1fr))",
      2: "repeat(2, minmax(0, 1fr))",
      3: "repeat(3, minmax(0, 1fr))",
      4: "repeat(4, minmax(0, 1fr))",
      5: "repeat(5, minmax(0, 1fr))",
      6: "repeat(6, minmax(0, 1fr))",
      7: "repeat(7, minmax(0, 1fr))",
      8: "repeat(8, minmax(0, 1fr))",
      9: "repeat(9, minmax(0, 1fr))",
      10: "repeat(10, minmax(0, 1fr))",
      11: "repeat(11, minmax(0, 1fr))",
      12: "repeat(12, minmax(0, 1fr))",
      ...bareRepeatValues
    },
    gridTemplateRows: {
      none: "none",
      subgrid: "subgrid",
      1: "repeat(1, minmax(0, 1fr))",
      2: "repeat(2, minmax(0, 1fr))",
      3: "repeat(3, minmax(0, 1fr))",
      4: "repeat(4, minmax(0, 1fr))",
      5: "repeat(5, minmax(0, 1fr))",
      6: "repeat(6, minmax(0, 1fr))",
      7: "repeat(7, minmax(0, 1fr))",
      8: "repeat(8, minmax(0, 1fr))",
      9: "repeat(9, minmax(0, 1fr))",
      10: "repeat(10, minmax(0, 1fr))",
      11: "repeat(11, minmax(0, 1fr))",
      12: "repeat(12, minmax(0, 1fr))",
      ...bareRepeatValues
    },
    height: ({ theme: theme2 }) => ({
      auto: "auto",
      "1/2": "50%",
      "1/3": "33.333333%",
      "2/3": "66.666667%",
      "1/4": "25%",
      "2/4": "50%",
      "3/4": "75%",
      "1/5": "20%",
      "2/5": "40%",
      "3/5": "60%",
      "4/5": "80%",
      "1/6": "16.666667%",
      "2/6": "33.333333%",
      "3/6": "50%",
      "4/6": "66.666667%",
      "5/6": "83.333333%",
      full: "100%",
      screen: "100vh",
      svh: "100svh",
      lvh: "100lvh",
      dvh: "100dvh",
      min: "min-content",
      max: "max-content",
      fit: "fit-content",
      ...theme2("spacing")
    }),
    hueRotate: {
      0: "0deg",
      15: "15deg",
      30: "30deg",
      60: "60deg",
      90: "90deg",
      180: "180deg",
      ...bareDegrees
    },
    inset: ({ theme: theme2 }) => ({
      auto: "auto",
      "1/2": "50%",
      "1/3": "33.333333%",
      "2/3": "66.666667%",
      "1/4": "25%",
      "2/4": "50%",
      "3/4": "75%",
      full: "100%",
      ...theme2("spacing")
    }),
    invert: {
      0: "0",
      DEFAULT: "100%",
      ...barePercentages
    },
    keyframes: {
      spin: {
        to: {
          transform: "rotate(360deg)"
        }
      },
      ping: {
        "75%, 100%": {
          transform: "scale(2)",
          opacity: "0"
        }
      },
      pulse: {
        "50%": {
          opacity: ".5"
        }
      },
      bounce: {
        "0%, 100%": {
          transform: "translateY(-25%)",
          animationTimingFunction: "cubic-bezier(0.8,0,1,1)"
        },
        "50%": {
          transform: "none",
          animationTimingFunction: "cubic-bezier(0,0,0.2,1)"
        }
      }
    },
    letterSpacing: {
      tighter: "-0.05em",
      tight: "-0.025em",
      normal: "0em",
      wide: "0.025em",
      wider: "0.05em",
      widest: "0.1em"
    },
    lineHeight: {
      none: "1",
      tight: "1.25",
      snug: "1.375",
      normal: "1.5",
      relaxed: "1.625",
      loose: "2",
      3: ".75rem",
      4: "1rem",
      5: "1.25rem",
      6: "1.5rem",
      7: "1.75rem",
      8: "2rem",
      9: "2.25rem",
      10: "2.5rem"
    },
    listStyleType: {
      none: "none",
      disc: "disc",
      decimal: "decimal"
    },
    listStyleImage: {
      none: "none"
    },
    margin: ({ theme: theme2 }) => ({
      auto: "auto",
      ...theme2("spacing")
    }),
    lineClamp: {
      1: "1",
      2: "2",
      3: "3",
      4: "4",
      5: "5",
      6: "6",
      ...bareIntegers
    },
    maxHeight: ({ theme: theme2 }) => ({
      none: "none",
      full: "100%",
      screen: "100vh",
      svh: "100svh",
      lvh: "100lvh",
      dvh: "100dvh",
      min: "min-content",
      max: "max-content",
      fit: "fit-content",
      ...theme2("spacing")
    }),
    maxWidth: ({ theme: theme2 }) => ({
      none: "none",
      xs: "20rem",
      sm: "24rem",
      md: "28rem",
      lg: "32rem",
      xl: "36rem",
      "2xl": "42rem",
      "3xl": "48rem",
      "4xl": "56rem",
      "5xl": "64rem",
      "6xl": "72rem",
      "7xl": "80rem",
      full: "100%",
      min: "min-content",
      max: "max-content",
      fit: "fit-content",
      prose: "65ch",
      ...theme2("spacing")
    }),
    minHeight: ({ theme: theme2 }) => ({
      full: "100%",
      screen: "100vh",
      svh: "100svh",
      lvh: "100lvh",
      dvh: "100dvh",
      min: "min-content",
      max: "max-content",
      fit: "fit-content",
      ...theme2("spacing")
    }),
    minWidth: ({ theme: theme2 }) => ({
      full: "100%",
      min: "min-content",
      max: "max-content",
      fit: "fit-content",
      ...theme2("spacing")
    }),
    objectPosition: {
      bottom: "bottom",
      center: "center",
      left: "left",
      "left-bottom": "left bottom",
      "left-top": "left top",
      right: "right",
      "right-bottom": "right bottom",
      "right-top": "right top",
      top: "top"
    },
    opacity: {
      0: "0",
      5: "0.05",
      10: "0.1",
      15: "0.15",
      20: "0.2",
      25: "0.25",
      30: "0.3",
      35: "0.35",
      40: "0.4",
      45: "0.45",
      50: "0.5",
      55: "0.55",
      60: "0.6",
      65: "0.65",
      70: "0.7",
      75: "0.75",
      80: "0.8",
      85: "0.85",
      90: "0.9",
      95: "0.95",
      100: "1",
      ...barePercentages
    },
    order: {
      first: "-9999",
      last: "9999",
      none: "0",
      1: "1",
      2: "2",
      3: "3",
      4: "4",
      5: "5",
      6: "6",
      7: "7",
      8: "8",
      9: "9",
      10: "10",
      11: "11",
      12: "12",
      ...bareIntegers
    },
    outlineColor: ({ theme: theme2 }) => theme2("colors"),
    outlineOffset: {
      0: "0px",
      1: "1px",
      2: "2px",
      4: "4px",
      8: "8px",
      ...barePixels
    },
    outlineWidth: {
      0: "0px",
      1: "1px",
      2: "2px",
      4: "4px",
      8: "8px",
      ...barePixels
    },
    padding: ({ theme: theme2 }) => theme2("spacing"),
    placeholderColor: ({ theme: theme2 }) => theme2("colors"),
    placeholderOpacity: ({ theme: theme2 }) => theme2("opacity"),
    ringColor: ({ theme: theme2 }) => ({
      DEFAULT: "currentcolor",
      ...theme2("colors")
    }),
    ringOffsetColor: ({ theme: theme2 }) => theme2("colors"),
    ringOffsetWidth: {
      0: "0px",
      1: "1px",
      2: "2px",
      4: "4px",
      8: "8px",
      ...barePixels
    },
    ringOpacity: ({ theme: theme2 }) => ({
      DEFAULT: "0.5",
      ...theme2("opacity")
    }),
    ringWidth: {
      DEFAULT: "3px",
      0: "0px",
      1: "1px",
      2: "2px",
      4: "4px",
      8: "8px",
      ...barePixels
    },
    rotate: {
      0: "0deg",
      1: "1deg",
      2: "2deg",
      3: "3deg",
      6: "6deg",
      12: "12deg",
      45: "45deg",
      90: "90deg",
      180: "180deg",
      ...bareDegrees
    },
    saturate: {
      0: "0",
      50: ".5",
      100: "1",
      150: "1.5",
      200: "2",
      ...barePercentages
    },
    scale: {
      0: "0",
      50: ".5",
      75: ".75",
      90: ".9",
      95: ".95",
      100: "1",
      105: "1.05",
      110: "1.1",
      125: "1.25",
      150: "1.5",
      ...barePercentages
    },
    screens: {
      sm: "40rem",
      md: "48rem",
      lg: "64rem",
      xl: "80rem",
      "2xl": "96rem"
    },
    scrollMargin: ({ theme: theme2 }) => theme2("spacing"),
    scrollPadding: ({ theme: theme2 }) => theme2("spacing"),
    sepia: {
      0: "0",
      DEFAULT: "100%",
      ...barePercentages
    },
    skew: {
      0: "0deg",
      1: "1deg",
      2: "2deg",
      3: "3deg",
      6: "6deg",
      12: "12deg",
      ...bareDegrees
    },
    space: ({ theme: theme2 }) => theme2("spacing"),
    spacing: {
      px: "1px",
      0: "0px",
      0.5: "0.125rem",
      1: "0.25rem",
      1.5: "0.375rem",
      2: "0.5rem",
      2.5: "0.625rem",
      3: "0.75rem",
      3.5: "0.875rem",
      4: "1rem",
      5: "1.25rem",
      6: "1.5rem",
      7: "1.75rem",
      8: "2rem",
      9: "2.25rem",
      10: "2.5rem",
      11: "2.75rem",
      12: "3rem",
      14: "3.5rem",
      16: "4rem",
      20: "5rem",
      24: "6rem",
      28: "7rem",
      32: "8rem",
      36: "9rem",
      40: "10rem",
      44: "11rem",
      48: "12rem",
      52: "13rem",
      56: "14rem",
      60: "15rem",
      64: "16rem",
      72: "18rem",
      80: "20rem",
      96: "24rem"
    },
    stroke: ({ theme: theme2 }) => ({
      none: "none",
      ...theme2("colors")
    }),
    strokeWidth: {
      0: "0",
      1: "1",
      2: "2",
      ...bareIntegers
    },
    supports: {},
    data: {},
    textColor: ({ theme: theme2 }) => theme2("colors"),
    textDecorationColor: ({ theme: theme2 }) => theme2("colors"),
    textDecorationThickness: {
      auto: "auto",
      "from-font": "from-font",
      0: "0px",
      1: "1px",
      2: "2px",
      4: "4px",
      8: "8px",
      ...barePixels
    },
    textIndent: ({ theme: theme2 }) => theme2("spacing"),
    textOpacity: ({ theme: theme2 }) => theme2("opacity"),
    textUnderlineOffset: {
      auto: "auto",
      0: "0px",
      1: "1px",
      2: "2px",
      4: "4px",
      8: "8px",
      ...barePixels
    },
    transformOrigin: {
      center: "center",
      top: "top",
      "top-right": "top right",
      right: "right",
      "bottom-right": "bottom right",
      bottom: "bottom",
      "bottom-left": "bottom left",
      left: "left",
      "top-left": "top left"
    },
    transitionDelay: {
      0: "0s",
      75: "75ms",
      100: "100ms",
      150: "150ms",
      200: "200ms",
      300: "300ms",
      500: "500ms",
      700: "700ms",
      1e3: "1000ms",
      ...bareMilliseconds
    },
    transitionDuration: {
      DEFAULT: "150ms",
      0: "0s",
      75: "75ms",
      100: "100ms",
      150: "150ms",
      200: "200ms",
      300: "300ms",
      500: "500ms",
      700: "700ms",
      1e3: "1000ms",
      ...bareMilliseconds
    },
    transitionProperty: {
      none: "none",
      all: "all",
      DEFAULT: "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
      colors: "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
      opacity: "opacity",
      shadow: "box-shadow",
      transform: "transform"
    },
    transitionTimingFunction: {
      DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
      linear: "linear",
      in: "cubic-bezier(0.4, 0, 1, 1)",
      out: "cubic-bezier(0, 0, 0.2, 1)",
      "in-out": "cubic-bezier(0.4, 0, 0.2, 1)"
    },
    translate: ({ theme: theme2 }) => ({
      "1/2": "50%",
      "1/3": "33.333333%",
      "2/3": "66.666667%",
      "1/4": "25%",
      "2/4": "50%",
      "3/4": "75%",
      full: "100%",
      ...theme2("spacing")
    }),
    size: ({ theme: theme2 }) => ({
      auto: "auto",
      "1/2": "50%",
      "1/3": "33.333333%",
      "2/3": "66.666667%",
      "1/4": "25%",
      "2/4": "50%",
      "3/4": "75%",
      "1/5": "20%",
      "2/5": "40%",
      "3/5": "60%",
      "4/5": "80%",
      "1/6": "16.666667%",
      "2/6": "33.333333%",
      "3/6": "50%",
      "4/6": "66.666667%",
      "5/6": "83.333333%",
      "1/12": "8.333333%",
      "2/12": "16.666667%",
      "3/12": "25%",
      "4/12": "33.333333%",
      "5/12": "41.666667%",
      "6/12": "50%",
      "7/12": "58.333333%",
      "8/12": "66.666667%",
      "9/12": "75%",
      "10/12": "83.333333%",
      "11/12": "91.666667%",
      full: "100%",
      min: "min-content",
      max: "max-content",
      fit: "fit-content",
      ...theme2("spacing")
    }),
    width: ({ theme: theme2 }) => ({
      auto: "auto",
      "1/2": "50%",
      "1/3": "33.333333%",
      "2/3": "66.666667%",
      "1/4": "25%",
      "2/4": "50%",
      "3/4": "75%",
      "1/5": "20%",
      "2/5": "40%",
      "3/5": "60%",
      "4/5": "80%",
      "1/6": "16.666667%",
      "2/6": "33.333333%",
      "3/6": "50%",
      "4/6": "66.666667%",
      "5/6": "83.333333%",
      "1/12": "8.333333%",
      "2/12": "16.666667%",
      "3/12": "25%",
      "4/12": "33.333333%",
      "5/12": "41.666667%",
      "6/12": "50%",
      "7/12": "58.333333%",
      "8/12": "66.666667%",
      "9/12": "75%",
      "10/12": "83.333333%",
      "11/12": "91.666667%",
      full: "100%",
      screen: "100vw",
      svw: "100svw",
      lvw: "100lvw",
      dvw: "100dvw",
      min: "min-content",
      max: "max-content",
      fit: "fit-content",
      ...theme2("spacing")
    }),
    willChange: {
      auto: "auto",
      scroll: "scroll-position",
      contents: "contents",
      transform: "transform"
    },
    zIndex: {
      auto: "auto",
      0: "0",
      10: "10",
      20: "20",
      30: "30",
      40: "40",
      50: "50",
      ...bareIntegers
    }
  };

  // ../tailwindcss/packages/tailwindcss/src/compat/config/create-compat-config.ts
  function createCompatConfig(cssTheme) {
    return {
      theme: {
        ...default_theme_default,
        // In the defaultTheme config, the `colors` key is not a function but a
        // shallow object. We don't want to define the color namespace unless it
        // is in the CSS theme so here we explicitly overwrite the defaultTheme
        // and only allow colors from the CSS theme.
        colors: ({ theme: theme2 }) => theme2("color", {}),
        extend: {
          fontSize: ({ theme: theme2 }) => ({
            ...theme2("text", {})
          }),
          boxShadow: ({ theme: theme2 }) => ({
            ...theme2("shadow", {})
          }),
          animation: ({ theme: theme2 }) => ({
            ...theme2("animate", {})
          }),
          aspectRatio: ({ theme: theme2 }) => ({
            ...theme2("aspect", {})
          }),
          borderRadius: ({ theme: theme2 }) => ({
            ...theme2("radius", {})
          }),
          screens: ({ theme: theme2 }) => ({
            ...theme2("breakpoint", {})
          }),
          letterSpacing: ({ theme: theme2 }) => ({
            ...theme2("tracking", {})
          }),
          lineHeight: ({ theme: theme2 }) => ({
            ...theme2("leading", {})
          }),
          transitionDuration: {
            DEFAULT: cssTheme.get(["--default-transition-duration"]) ?? null
          },
          transitionTimingFunction: {
            DEFAULT: cssTheme.get(["--default-transition-timing-function"]) ?? null
          },
          maxWidth: ({ theme: theme2 }) => ({
            ...theme2("container", {})
          })
        }
      }
    };
  }

  // ../tailwindcss/packages/tailwindcss/src/compat/config/resolve-config.ts
  var minimal = {
    blocklist: [],
    future: {},
    experimental: {},
    prefix: "",
    important: false,
    darkMode: null,
    theme: {},
    plugins: [],
    content: {
      files: []
    }
  };
  function resolveConfig(design, files) {
    let ctx = {
      design,
      configs: [],
      plugins: [],
      content: {
        files: []
      },
      theme: {},
      extend: {},
      // Start with a minimal valid, but empty config
      result: structuredClone(minimal)
    };
    for (let file of files) {
      extractConfigs(ctx, file);
    }
    for (let config of ctx.configs) {
      if ("darkMode" in config && config.darkMode !== void 0) {
        ctx.result.darkMode = config.darkMode ?? null;
      }
      if ("prefix" in config && config.prefix !== void 0) {
        ctx.result.prefix = config.prefix ?? "";
      }
      if ("blocklist" in config && config.blocklist !== void 0) {
        ctx.result.blocklist = config.blocklist ?? [];
      }
      if ("important" in config && config.important !== void 0) {
        ctx.result.important = config.important ?? false;
      }
    }
    let replacedThemeKeys = mergeTheme(ctx);
    return {
      resolvedConfig: {
        ...ctx.result,
        content: ctx.content,
        theme: ctx.theme,
        plugins: ctx.plugins
      },
      replacedThemeKeys
    };
  }
  function mergeThemeExtension(themeValue, extensionValue) {
    if (Array.isArray(themeValue) && isPlainObject(themeValue[0])) {
      return themeValue.concat(extensionValue);
    }
    if (Array.isArray(extensionValue) && isPlainObject(extensionValue[0]) && isPlainObject(themeValue)) {
      return [themeValue, ...extensionValue];
    }
    if (Array.isArray(extensionValue)) {
      return extensionValue;
    }
    return void 0;
  }
  function extractConfigs(ctx, { config, base: base2, path, reference, src }) {
    let plugins = [];
    for (let plugin2 of config.plugins ?? []) {
      if ("__isOptionsFunction" in plugin2) {
        plugins.push({ ...plugin2(), reference, src });
      } else if ("handler" in plugin2) {
        plugins.push({ ...plugin2, reference, src });
      } else {
        plugins.push({ handler: plugin2, reference, src });
      }
    }
    if (Array.isArray(config.presets) && config.presets.length === 0) {
      throw new Error(
        "Error in the config file/plugin/preset. An empty preset (`preset: []`) is not currently supported."
      );
    }
    for (let preset of config.presets ?? []) {
      extractConfigs(ctx, { path, base: base2, config: preset, reference, src });
    }
    for (let plugin2 of plugins) {
      ctx.plugins.push(plugin2);
      if (plugin2.config) {
        extractConfigs(ctx, {
          path,
          base: base2,
          config: plugin2.config,
          reference: !!plugin2.reference,
          src: plugin2.src ?? src
        });
      }
    }
    let content = config.content ?? [];
    let files = Array.isArray(content) ? content : content.files;
    for (let file of files) {
      ctx.content.files.push(typeof file === "object" ? file : { base: base2, pattern: file });
    }
    ctx.configs.push(config);
  }
  function mergeTheme(ctx) {
    let replacedThemeKeys = /* @__PURE__ */ new Set();
    let themeFn = createThemeFn(ctx.design, () => ctx.theme, resolveValue);
    let theme2 = Object.assign(themeFn, {
      theme: themeFn,
      colors: colors_default
    });
    function resolveValue(value2) {
      if (typeof value2 === "function") {
        return value2(theme2) ?? null;
      }
      return value2 ?? null;
    }
    for (let config of ctx.configs) {
      let theme3 = config.theme ?? {};
      let extend = theme3.extend ?? {};
      for (let key in theme3) {
        if (key === "extend") {
          continue;
        }
        replacedThemeKeys.add(key);
      }
      Object.assign(ctx.theme, theme3);
      for (let key in extend) {
        ctx.extend[key] ??= [];
        ctx.extend[key].push(extend[key]);
      }
    }
    delete ctx.theme.extend;
    for (let key in ctx.extend) {
      let values = [ctx.theme[key], ...ctx.extend[key]];
      ctx.theme[key] = () => {
        let v = values.map(resolveValue);
        let result = deepMerge({}, v, mergeThemeExtension);
        return result;
      };
    }
    for (let key in ctx.theme) {
      ctx.theme[key] = resolveValue(ctx.theme[key]);
    }
    if (ctx.theme.screens && typeof ctx.theme.screens === "object") {
      for (let key of Object.keys(ctx.theme.screens)) {
        let screen = ctx.theme.screens[key];
        if (!screen) continue;
        if (typeof screen !== "object") continue;
        if ("raw" in screen) continue;
        if ("max" in screen) continue;
        if (!("min" in screen)) continue;
        ctx.theme.screens[key] = screen.min;
      }
    }
    return replacedThemeKeys;
  }

  // ../tailwindcss/packages/tailwindcss/src/compat/container.ts
  function registerContainerCompat(userConfig, designSystem) {
    let container = userConfig.theme.container || {};
    if (typeof container !== "object" || container === null) {
      return;
    }
    let rules = buildCustomContainerUtilityRules(container, designSystem);
    if (rules.length === 0) {
      return;
    }
    designSystem.utilities.static("container", () => rules.map(cloneAstNode));
  }
  function buildCustomContainerUtilityRules({
    center,
    padding,
    screens
  }, designSystem) {
    let rules = [];
    let breakpointOverwrites = null;
    if (center) {
      rules.push(decl("margin-inline", "auto"));
    }
    if (typeof padding === "string" || typeof padding === "object" && padding !== null && "DEFAULT" in padding) {
      rules.push(
        decl("padding-inline", typeof padding === "string" ? padding : padding.DEFAULT)
      );
    }
    if (typeof screens === "object" && screens !== null) {
      breakpointOverwrites = /* @__PURE__ */ new Map();
      let breakpoints = Array.from(designSystem.theme.namespace("--breakpoint").entries());
      breakpoints.sort((a, z) => compareBreakpoints(a[1], z[1], "asc"));
      if (breakpoints.length > 0) {
        let [key] = breakpoints[0];
        rules.push(
          atRule("@media", `(width >= --theme(--breakpoint-${key}))`, [decl("max-width", "none")])
        );
      }
      for (let [key, value2] of Object.entries(screens)) {
        if (typeof value2 === "object") {
          if ("min" in value2) {
            value2 = value2.min;
          } else {
            continue;
          }
        }
        breakpointOverwrites.set(
          key,
          atRule("@media", `(width >= ${value2})`, [decl("max-width", value2)])
        );
      }
    }
    if (typeof padding === "object" && padding !== null) {
      let breakpoints = Object.entries(padding).filter(([key]) => key !== "DEFAULT").map(([key, value2]) => {
        return [key, designSystem.theme.resolveValue(key, ["--breakpoint"]), value2];
      }).filter(Boolean);
      breakpoints.sort((a, z) => compareBreakpoints(a[1], z[1], "asc"));
      for (let [key, , value2] of breakpoints) {
        if (breakpointOverwrites && breakpointOverwrites.has(key)) {
          let overwrite = breakpointOverwrites.get(key);
          overwrite.nodes.push(decl("padding-inline", value2));
        } else if (breakpointOverwrites) {
          continue;
        } else {
          rules.push(
            atRule("@media", `(width >= theme(--breakpoint-${key}))`, [
              decl("padding-inline", value2)
            ])
          );
        }
      }
    }
    if (breakpointOverwrites) {
      for (let [, rule2] of breakpointOverwrites) {
        rules.push(rule2);
      }
    }
    return rules;
  }

  // ../tailwindcss/packages/tailwindcss/src/compat/dark-mode.ts
  function darkModePlugin({ addVariant, config }) {
    let darkMode = config("darkMode", null);
    let [mode, selector2 = ".dark"] = Array.isArray(darkMode) ? darkMode : [darkMode];
    if (mode === "variant") {
      let formats;
      if (Array.isArray(selector2)) {
        formats = selector2;
      } else if (typeof selector2 === "function") {
        formats = selector2;
      } else if (typeof selector2 === "string") {
        formats = [selector2];
      }
      if (Array.isArray(formats)) {
        for (let format of formats) {
          if (format === ".dark") {
            mode = false;
            console.warn(
              'When using `variant` for `darkMode`, you must provide a selector.\nExample: `darkMode: ["variant", ".your-selector &"]`'
            );
          } else if (!format.includes("&")) {
            mode = false;
            console.warn(
              'When using `variant` for `darkMode`, your selector must contain `&`.\nExample `darkMode: ["variant", ".your-selector &"]`'
            );
          }
        }
      }
      selector2 = formats;
    }
    if (mode === null) {
    } else if (mode === "selector") {
      addVariant("dark", `&:where(${selector2}, ${selector2} *)`);
    } else if (mode === "media") {
      addVariant("dark", "@media (prefers-color-scheme: dark)");
    } else if (mode === "variant") {
      addVariant("dark", selector2);
    } else if (mode === "class") {
      addVariant("dark", `&:is(${selector2} *)`);
    }
  }

  // ../tailwindcss/packages/tailwindcss/src/compat/legacy-utilities.ts
  function registerLegacyUtilities(designSystem) {
    for (let [value2, direction] of [
      ["t", "top"],
      ["tr", "top right"],
      ["r", "right"],
      ["br", "bottom right"],
      ["b", "bottom"],
      ["bl", "bottom left"],
      ["l", "left"],
      ["tl", "top left"]
    ]) {
      designSystem.utilities.suggest(`bg-gradient-to-${value2}`, () => []);
      designSystem.utilities.static(`bg-gradient-to-${value2}`, () => [
        decl("--tw-gradient-position", `to ${direction} in oklab`),
        decl("background-image", `linear-gradient(var(--tw-gradient-stops))`)
      ]);
    }
    designSystem.utilities.suggest("bg-left-top", () => []);
    designSystem.utilities.static("bg-left-top", () => [decl("background-position", "left top")]);
    designSystem.utilities.suggest("bg-right-top", () => []);
    designSystem.utilities.static("bg-right-top", () => [decl("background-position", "right top")]);
    designSystem.utilities.suggest("bg-left-bottom", () => []);
    designSystem.utilities.static("bg-left-bottom", () => [
      decl("background-position", "left bottom")
    ]);
    designSystem.utilities.suggest("bg-right-bottom", () => []);
    designSystem.utilities.static("bg-right-bottom", () => [
      decl("background-position", "right bottom")
    ]);
    designSystem.utilities.suggest("object-left-top", () => []);
    designSystem.utilities.static("object-left-top", () => [decl("object-position", "left top")]);
    designSystem.utilities.suggest("object-right-top", () => []);
    designSystem.utilities.static("object-right-top", () => [decl("object-position", "right top")]);
    designSystem.utilities.suggest("object-left-bottom", () => []);
    designSystem.utilities.static("object-left-bottom", () => [
      decl("object-position", "left bottom")
    ]);
    designSystem.utilities.suggest("object-right-bottom", () => []);
    designSystem.utilities.static("object-right-bottom", () => [
      decl("object-position", "right bottom")
    ]);
    designSystem.utilities.suggest("max-w-screen", () => []);
    designSystem.utilities.functional("max-w-screen", (candidate) => {
      if (!candidate.value) return;
      if (candidate.value.kind === "arbitrary") return;
      let value2 = designSystem.theme.resolve(candidate.value.value, ["--breakpoint"]);
      if (!value2) return;
      return [decl("max-width", value2)];
    });
    designSystem.utilities.suggest("overflow-ellipsis", () => []);
    designSystem.utilities.static(`overflow-ellipsis`, () => [decl("text-overflow", `ellipsis`)]);
    designSystem.utilities.suggest("decoration-slice", () => []);
    designSystem.utilities.static(`decoration-slice`, () => [
      decl("-webkit-box-decoration-break", `slice`),
      decl("box-decoration-break", `slice`)
    ]);
    designSystem.utilities.suggest("decoration-clone", () => []);
    designSystem.utilities.static(`decoration-clone`, () => [
      decl("-webkit-box-decoration-break", `clone`),
      decl("box-decoration-break", `clone`)
    ]);
    designSystem.utilities.suggest("flex-shrink", () => []);
    designSystem.utilities.functional("flex-shrink", (candidate) => {
      if (candidate.modifier) return;
      if (!candidate.value) {
        return [decl("flex-shrink", "1")];
      }
      if (candidate.value.kind === "arbitrary") {
        return [decl("flex-shrink", candidate.value.value)];
      }
      if (isPositiveInteger(candidate.value.value)) {
        return [decl("flex-shrink", candidate.value.value)];
      }
    });
    designSystem.utilities.suggest("flex-grow", () => []);
    designSystem.utilities.functional("flex-grow", (candidate) => {
      if (candidate.modifier) return;
      if (!candidate.value) {
        return [decl("flex-grow", "1")];
      }
      if (candidate.value.kind === "arbitrary") {
        return [decl("flex-grow", candidate.value.value)];
      }
      if (isPositiveInteger(candidate.value.value)) {
        return [decl("flex-grow", candidate.value.value)];
      }
    });
    designSystem.utilities.suggest("order-none", () => []);
    designSystem.utilities.static("order-none", () => [decl("order", "0")]);
    designSystem.utilities.suggest("break-words", () => []);
    designSystem.utilities.static("break-words", () => [decl("overflow-wrap", "break-word")]);
    for (let [name, property2] of [
      ["start", "inset-inline-start"],
      ["end", "inset-inline-end"]
    ]) {
      let handleInset2 = function({ negative }) {
        return (candidate) => {
          if (candidate.value === null) return;
          if (candidate.value.kind === "arbitrary") {
            if (candidate.modifier) return;
            let value3 = candidate.value.value;
            return [decl(property2, negative ? `calc(${value3} * -1)` : value3)];
          }
          let value2 = designSystem.theme.resolve(candidate.value.fraction ?? candidate.value.value, [
            "--inset",
            "--spacing"
          ]);
          if (value2 === null && candidate.value.fraction) {
            let [lhs, rhs] = segment(candidate.value.fraction, "/");
            if (!isPositiveInteger(lhs) || !isPositiveInteger(rhs)) return;
            value2 = `calc(${candidate.value.fraction} * 100%)`;
          }
          if (value2 === null && negative) {
            let multiplier = designSystem.theme.resolve(null, ["--spacing"]);
            if (multiplier && isValidSpacingMultiplier(candidate.value.value)) {
              value2 = `calc(${multiplier} * -${candidate.value.value})`;
              if (value2 !== null) return [decl(property2, value2)];
            }
          }
          if (value2 === null) {
            let multiplier = designSystem.theme.resolve(null, ["--spacing"]);
            if (multiplier && isValidSpacingMultiplier(candidate.value.value)) {
              value2 = `calc(${multiplier} * ${candidate.value.value})`;
            }
          }
          if (value2 === null) return;
          return [decl(property2, negative ? `calc(${value2} * -1)` : value2)];
        };
      };
      var handleInset = handleInset2;
      designSystem.utilities.static(`${name}-auto`, () => [decl(property2, "auto")]);
      designSystem.utilities.static(`${name}-full`, () => [decl(property2, "100%")]);
      designSystem.utilities.static(`-${name}-full`, () => [decl(property2, "-100%")]);
      designSystem.utilities.static(`${name}-px`, () => [decl(property2, "1px")]);
      designSystem.utilities.static(`-${name}-px`, () => [decl(property2, "-1px")]);
      designSystem.utilities.functional(`-${name}`, handleInset2({ negative: true }));
      designSystem.utilities.functional(name, handleInset2({ negative: false }));
    }
  }

  // ../tailwindcss/packages/tailwindcss/src/compat/screens-config.ts
  function registerScreensConfig(userConfig, designSystem) {
    let screens = userConfig.theme.screens || {};
    let coreOrder = designSystem.variants.get("min")?.order ?? 0;
    let additionalVariants = [];
    for (let [name, value2] of Object.entries(screens)) {
      let insert2 = function(order) {
        designSystem.variants.static(
          name,
          (ruleNode) => {
            ruleNode.nodes = [atRule("@media", query, ruleNode.nodes)];
          },
          { order }
        );
      };
      var insert = insert2;
      let coreVariant = designSystem.variants.get(name);
      let cssValue = designSystem.theme.resolveValue(name, ["--breakpoint"]);
      if (coreVariant && cssValue && !designSystem.theme.hasDefault(`--breakpoint-${name}`)) {
        continue;
      }
      let deferInsert = true;
      if (typeof value2 === "string") {
        deferInsert = false;
      }
      let query = buildMediaQuery(value2);
      if (deferInsert) {
        additionalVariants.push(insert2);
      } else {
        insert2(coreOrder);
      }
    }
    if (additionalVariants.length === 0) return;
    for (let [, variant] of designSystem.variants.variants) {
      if (variant.order > coreOrder) variant.order += additionalVariants.length;
    }
    designSystem.variants.compareFns = new Map(
      Array.from(designSystem.variants.compareFns).map(([key, value2]) => {
        if (key > coreOrder) key += additionalVariants.length;
        return [key, value2];
      })
    );
    for (let [index, callback] of additionalVariants.entries()) {
      callback(coreOrder + index + 1);
    }
  }
  function buildMediaQuery(values) {
    let list2 = Array.isArray(values) ? values : [values];
    return list2.map((value2) => {
      if (typeof value2 === "string") {
        return { min: value2 };
      }
      if (value2 && typeof value2 === "object") {
        return value2;
      }
      return null;
    }).map((screen) => {
      if (screen === null) return null;
      if ("raw" in screen) {
        return screen.raw;
      }
      let query = "";
      if (screen.max !== void 0) {
        query += `${screen.max} >= `;
      }
      query += "width";
      if (screen.min !== void 0) {
        query += ` >= ${screen.min}`;
      }
      return `(${query})`;
    }).filter(Boolean).join(", ");
  }

  // ../tailwindcss/packages/tailwindcss/src/compat/theme-variants.ts
  function registerThemeVariantOverrides(config, designSystem) {
    let ariaVariants = config.theme.aria || {};
    let supportsVariants = config.theme.supports || {};
    let dataVariants = config.theme.data || {};
    if (Object.keys(ariaVariants).length > 0) {
      let coreAria = designSystem.variants.get("aria");
      let applyFn = coreAria?.applyFn;
      let compounds = coreAria?.compounds;
      designSystem.variants.functional(
        "aria",
        (ruleNode, variant) => {
          let value2 = variant.value;
          if (value2 && value2.kind === "named" && value2.value in ariaVariants) {
            return applyFn?.(ruleNode, {
              ...variant,
              value: { kind: "arbitrary", value: ariaVariants[value2.value] }
            });
          }
          return applyFn?.(ruleNode, variant);
        },
        { compounds }
      );
    }
    if (Object.keys(supportsVariants).length > 0) {
      let coreSupports = designSystem.variants.get("supports");
      let applyFn = coreSupports?.applyFn;
      let compounds = coreSupports?.compounds;
      designSystem.variants.functional(
        "supports",
        (ruleNode, variant) => {
          let value2 = variant.value;
          if (value2 && value2.kind === "named" && value2.value in supportsVariants) {
            return applyFn?.(ruleNode, {
              ...variant,
              value: { kind: "arbitrary", value: supportsVariants[value2.value] }
            });
          }
          return applyFn?.(ruleNode, variant);
        },
        { compounds }
      );
    }
    if (Object.keys(dataVariants).length > 0) {
      let coreData = designSystem.variants.get("data");
      let applyFn = coreData?.applyFn;
      let compounds = coreData?.compounds;
      designSystem.variants.functional(
        "data",
        (ruleNode, variant) => {
          let value2 = variant.value;
          if (value2 && value2.kind === "named" && value2.value in dataVariants) {
            return applyFn?.(ruleNode, {
              ...variant,
              value: { kind: "arbitrary", value: dataVariants[value2.value] }
            });
          }
          return applyFn?.(ruleNode, variant);
        },
        { compounds }
      );
    }
  }

  // ../tailwindcss/packages/tailwindcss/src/compat/apply-compat-hooks.ts
  var IS_VALID_PREFIX = /^[a-z]+$/;
  async function applyCompatibilityHooks({
    designSystem,
    base: base2,
    ast,
    loadModule,
    sources
  }) {
    let features = 0 /* None */;
    let pluginPaths = [];
    let configPaths = [];
    walk(ast, (node, _ctx) => {
      if (node.kind !== "at-rule") return;
      let ctx = cssContext(_ctx);
      if (node.name === "@plugin") {
        if (ctx.parent !== null) {
          throw new Error("`@plugin` cannot be nested.");
        }
        let pluginPath = node.params.slice(1, -1);
        if (pluginPath.length === 0) {
          throw new Error("`@plugin` must have a path.");
        }
        let options = {};
        for (let decl2 of node.nodes ?? []) {
          if (decl2.kind !== "declaration") {
            throw new Error(
              `Unexpected \`@plugin\` option:

${toCss3([decl2])}

\`@plugin\` options must be a flat list of declarations.`
            );
          }
          if (decl2.value === void 0) continue;
          let value2 = decl2.value;
          let parts = segment(value2, ",").map((part) => {
            part = part.trim();
            if (part === "null") {
              return null;
            } else if (part === "true") {
              return true;
            } else if (part === "false") {
              return false;
            } else if (!Number.isNaN(Number(part))) {
              return Number(part);
            } else if (part[0] === '"' && part[part.length - 1] === '"' || part[0] === "'" && part[part.length - 1] === "'") {
              return part.slice(1, -1);
            } else if (part[0] === "{" && part[part.length - 1] === "}") {
              throw new Error(
                `Unexpected \`@plugin\` option: Value of declaration \`${toCss3([decl2]).trim()}\` is not supported.

Using an object as a plugin option is currently only supported in JavaScript configuration files.`
              );
            }
            return part;
          });
          options[decl2.property] = parts.length === 1 ? parts[0] : parts;
        }
        pluginPaths.push([
          {
            id: pluginPath,
            base: ctx.context.base,
            reference: !!ctx.context.reference,
            src: node.src
          },
          Object.keys(options).length > 0 ? options : null
        ]);
        features |= 4 /* JsPluginCompat */;
        return WalkAction.Replace([]);
      }
      if (node.name === "@config") {
        if (node.nodes.length > 0) {
          throw new Error("`@config` cannot have a body.");
        }
        if (ctx.parent !== null) {
          throw new Error("`@config` cannot be nested.");
        }
        configPaths.push({
          id: node.params.slice(1, -1),
          base: ctx.context.base,
          reference: !!ctx.context.reference,
          src: node.src
        });
        features |= 4 /* JsPluginCompat */;
        return WalkAction.Replace([]);
      }
    });
    registerLegacyUtilities(designSystem);
    let resolveThemeVariableValue = designSystem.resolveThemeValue;
    designSystem.resolveThemeValue = function resolveThemeValue2(path, forceInline) {
      if (path.startsWith("--")) {
        return resolveThemeVariableValue(path, forceInline);
      }
      features |= upgradeToFullPluginSupport({
        designSystem,
        base: base2,
        ast,
        sources,
        configs: [],
        pluginDetails: []
      });
      return designSystem.resolveThemeValue(path, forceInline);
    };
    if (!pluginPaths.length && !configPaths.length) return 0 /* None */;
    let [configs, pluginDetails] = await Promise.all([
      Promise.all(
        configPaths.map(async ({ id, base: base3, reference, src }) => {
          let loaded = await loadModule(id, base3, "config");
          return {
            path: id,
            base: loaded.base,
            config: loaded.module,
            reference,
            src
          };
        })
      ),
      Promise.all(
        pluginPaths.map(async ([{ id, base: base3, reference, src }, pluginOptions]) => {
          let loaded = await loadModule(id, base3, "plugin");
          return {
            path: id,
            base: loaded.base,
            plugin: loaded.module,
            options: pluginOptions,
            reference,
            src
          };
        })
      )
    ]);
    features |= upgradeToFullPluginSupport({
      designSystem,
      base: base2,
      ast,
      sources,
      configs,
      pluginDetails
    });
    return features;
  }
  function upgradeToFullPluginSupport({
    designSystem,
    base: base2,
    ast,
    sources,
    configs,
    pluginDetails
  }) {
    let features = 0 /* None */;
    let pluginConfigs = pluginDetails.map((detail) => {
      if (!detail.options) {
        return {
          config: { plugins: [detail.plugin] },
          base: detail.base,
          reference: detail.reference,
          src: detail.src
        };
      }
      if ("__isOptionsFunction" in detail.plugin) {
        return {
          config: { plugins: [detail.plugin(detail.options)] },
          base: detail.base,
          reference: detail.reference,
          src: detail.src
        };
      }
      throw new Error(`The plugin "${detail.path}" does not accept options`);
    });
    let userConfig = [...pluginConfigs, ...configs];
    let { resolvedConfig } = resolveConfig(designSystem, [
      { config: createCompatConfig(designSystem.theme), base: base2, reference: true, src: void 0 },
      ...userConfig,
      { config: { plugins: [darkModePlugin] }, base: base2, reference: true, src: void 0 }
    ]);
    let { resolvedConfig: resolvedUserConfig, replacedThemeKeys } = resolveConfig(
      designSystem,
      userConfig
    );
    let pluginApiConfig = {
      designSystem,
      ast,
      resolvedConfig,
      featuresRef: {
        set current(value2) {
          features |= value2;
        }
      }
    };
    let sharedPluginApi = buildPluginApi({
      ...pluginApiConfig,
      referenceMode: false,
      src: void 0
    });
    let defaultResolveThemeValue = designSystem.resolveThemeValue;
    designSystem.resolveThemeValue = function resolveThemeValue2(path, forceInline) {
      if (path[0] === "-" && path[1] === "-") {
        return defaultResolveThemeValue(path, forceInline);
      }
      let resolvedValue = sharedPluginApi.theme(path, void 0);
      if (typeof resolvedValue === "object" && resolvedValue !== null && !Array.isArray(resolvedValue) && "DEFAULT" in resolvedValue) {
        resolvedValue = resolvedValue.DEFAULT;
      }
      if (Array.isArray(resolvedValue) && resolvedValue.length === 2) {
        return resolvedValue[0];
      } else if (Array.isArray(resolvedValue)) {
        return resolvedValue.join(", ");
      } else if (typeof resolvedValue === "string") {
        return resolvedValue;
      }
    };
    for (let { handler, reference, src } of resolvedConfig.plugins) {
      let api = buildPluginApi({
        ...pluginApiConfig,
        referenceMode: reference ?? false,
        src
      });
      handler(api);
    }
    applyConfigToTheme(designSystem, resolvedUserConfig, replacedThemeKeys);
    applyKeyframesToTheme(designSystem, resolvedUserConfig);
    registerThemeVariantOverrides(resolvedUserConfig, designSystem);
    registerScreensConfig(resolvedUserConfig, designSystem);
    registerContainerCompat(resolvedUserConfig, designSystem);
    if (!designSystem.theme.prefix && resolvedConfig.prefix) {
      if (resolvedConfig.prefix.endsWith("-")) {
        resolvedConfig.prefix = resolvedConfig.prefix.slice(0, -1);
        console.warn(
          `The prefix "${resolvedConfig.prefix}" is invalid. Prefixes must be lowercase ASCII letters (a-z) only and is written as a variant before all utilities. We have fixed up the prefix for you. Remove the trailing \`-\` to silence this warning.`
        );
      }
      if (!IS_VALID_PREFIX.test(resolvedConfig.prefix)) {
        throw new Error(
          `The prefix "${resolvedConfig.prefix}" is invalid. Prefixes must be lowercase ASCII letters (a-z) only.`
        );
      }
      designSystem.theme.prefix = resolvedConfig.prefix;
    }
    if (!designSystem.important && resolvedConfig.important === true) {
      designSystem.important = true;
    }
    if (typeof resolvedConfig.important === "string") {
      let wrappingSelector = resolvedConfig.important;
      walk(ast, (node, _ctx) => {
        if (node.kind !== "at-rule") return;
        if (node.name !== "@tailwind" || node.params !== "utilities") return;
        let ctx = cssContext(_ctx);
        if (ctx.parent?.kind === "rule" && ctx.parent.selector === wrappingSelector) {
          return WalkAction.Stop;
        }
        return WalkAction.ReplaceStop(styleRule(wrappingSelector, [node]));
      });
    }
    for (let candidate of resolvedConfig.blocklist) {
      designSystem.invalidCandidates.add(candidate);
    }
    for (let file of resolvedConfig.content.files) {
      if ("raw" in file) {
        throw new Error(
          `Error in the config file/plugin/preset. The \`content\` key contains a \`raw\` entry:

${JSON.stringify(file, null, 2)}

This feature is not currently supported.`
        );
      }
      let negated = false;
      if (file.pattern[0] == "!") {
        negated = true;
        file.pattern = file.pattern.slice(1);
      }
      sources.push({ ...file, negated });
    }
    return features;
  }

  // ../tailwindcss/packages/tailwindcss/src/source-maps/source-map.ts
  function createSourceMap({ ast }) {
    let lineTables = new DefaultMap((src) => createLineTable(src.code));
    let sourceTable = new DefaultMap((src) => ({
      url: src.file,
      content: src.code,
      ignore: false
    }));
    let map = {
      file: null,
      sources: [],
      mappings: []
    };
    walk(ast, (node) => {
      if (!node.src || !node.dst) return;
      let originalSource = sourceTable.get(node.src[0]);
      if (!originalSource.content) return;
      let originalTable = lineTables.get(node.src[0]);
      let generatedTable = lineTables.get(node.dst[0]);
      let originalSlice = originalSource.content.slice(node.src[1], node.src[2]);
      let offset = 0;
      for (let line of originalSlice.split("\n")) {
        if (line.trim() !== "") {
          let originalStart = originalTable.find(node.src[1] + offset);
          let generatedStart = generatedTable.find(node.dst[1]);
          map.mappings.push({
            name: null,
            originalPosition: {
              source: originalSource,
              ...originalStart
            },
            generatedPosition: generatedStart
          });
        }
        offset += line.length;
        offset += 1;
      }
      let originalEnd = originalTable.find(node.src[2]);
      let generatedEnd = generatedTable.find(node.dst[2]);
      map.mappings.push({
        name: null,
        originalPosition: {
          source: originalSource,
          ...originalEnd
        },
        generatedPosition: generatedEnd
      });
    });
    for (let source of lineTables.keys()) {
      map.sources.push(sourceTable.get(source));
    }
    map.mappings.sort((a, b) => {
      return a.generatedPosition.line - b.generatedPosition.line || a.generatedPosition.column - b.generatedPosition.column || (a.originalPosition?.line ?? 0) - (b.originalPosition?.line ?? 0) || (a.originalPosition?.column ?? 0) - (b.originalPosition?.column ?? 0);
    });
    return map;
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/brace-expansion.ts
  var NUMERICAL_RANGE = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/;
  function expand(pattern) {
    let index = pattern.indexOf("{");
    if (index === -1) return [pattern];
    let result = [];
    let pre = pattern.slice(0, index);
    let rest = pattern.slice(index);
    let depth = 0;
    let endIndex = rest.lastIndexOf("}");
    for (let i = 0; i < rest.length; i++) {
      let char = rest[i];
      if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }
    if (endIndex === -1) {
      throw new Error(`The pattern \`${pattern}\` is not balanced.`);
    }
    let inside = rest.slice(1, endIndex);
    let post = rest.slice(endIndex + 1);
    let parts;
    if (isSequence(inside)) {
      parts = expandSequence(inside);
    } else {
      parts = segment(inside, ",");
    }
    parts = parts.flatMap((part) => expand(part));
    let expandedTail = expand(post);
    for (let tail of expandedTail) {
      for (let part of parts) {
        result.push(pre + part + tail);
      }
    }
    return result;
  }
  function isSequence(str) {
    return NUMERICAL_RANGE.test(str);
  }
  function expandSequence(seq) {
    let seqMatch = seq.match(NUMERICAL_RANGE);
    if (!seqMatch) {
      return [seq];
    }
    let [, start, end, stepStr] = seqMatch;
    let step = stepStr ? parseInt(stepStr, 10) : void 0;
    let result = [];
    if (/^-?\d+$/.test(start) && /^-?\d+$/.test(end)) {
      let startNum = parseInt(start, 10);
      let endNum = parseInt(end, 10);
      if (step === void 0) {
        step = startNum <= endNum ? 1 : -1;
      }
      if (step === 0) {
        throw new Error("Step cannot be zero in sequence expansion.");
      }
      let increasing = startNum < endNum;
      if (increasing && step < 0) step = -step;
      if (!increasing && step > 0) step = -step;
      for (let i = startNum; increasing ? i <= endNum : i >= endNum; i += step) {
        result.push(i.toString());
      }
    }
    return result;
  }

  // ../tailwindcss/packages/tailwindcss/src/utils/topological-sort.ts
  function topologicalSort(graph, options) {
    let seen = /* @__PURE__ */ new Set();
    let wip = /* @__PURE__ */ new Set();
    let sorted = [];
    function visit(node, path = []) {
      if (!graph.has(node)) return;
      if (seen.has(node)) return;
      if (wip.has(node)) options.onCircularDependency?.(path, node);
      wip.add(node);
      for (let dependency of graph.get(node) ?? []) {
        path.push(node);
        visit(dependency, path);
        path.pop();
      }
      seen.add(node);
      wip.delete(node);
      sorted.push(node);
    }
    for (let node of graph.keys()) {
      visit(node);
    }
    return sorted;
  }

  // ../tailwindcss/packages/tailwindcss/src/index.ts
  var IS_VALID_PREFIX2 = /^[a-z]+$/;
  function throwOnLoadModule() {
    throw new Error("No `loadModule` function provided to `compile`");
  }
  function throwOnLoadStylesheet() {
    throw new Error("No `loadStylesheet` function provided to `compile`");
  }
  function parseThemeOptions(params) {
    let options = 0 /* NONE */;
    let prefix = null;
    for (let option of segment(params, " ")) {
      if (option === "reference") {
        options |= 2 /* REFERENCE */;
      } else if (option === "inline") {
        options |= 1 /* INLINE */;
      } else if (option === "default") {
        options |= 4 /* DEFAULT */;
      } else if (option === "static") {
        options |= 8 /* STATIC */;
      } else if (option.startsWith("prefix(") && option.endsWith(")")) {
        prefix = option.slice(7, -1);
      }
    }
    return [options, prefix];
  }
  async function parseCss(ast, {
    base: base2 = "",
    from,
    loadModule = throwOnLoadModule,
    loadStylesheet = throwOnLoadStylesheet
  } = {}) {
    let features = 0 /* None */;
    ast = [context({ base: base2 }, ast)];
    features |= await substituteAtImports(ast, base2, loadStylesheet, 0, from !== void 0);
    let important = null;
    let theme2 = new Theme();
    let customVariants = /* @__PURE__ */ new Map();
    let customVariantDependencies = /* @__PURE__ */ new Map();
    let customUtilities = [];
    let firstThemeRule = null;
    let utilitiesNode = null;
    let variantNodes = [];
    let sources = [];
    let inlineCandidates = [];
    let ignoredCandidates = [];
    let root = null;
    walk(ast, (node, _ctx) => {
      if (node.kind !== "at-rule") return;
      let ctx = cssContext(_ctx);
      if (node.name === "@tailwind" && (node.params === "utilities" || node.params.startsWith("utilities"))) {
        if (utilitiesNode !== null) {
          return WalkAction.Replace([]);
        }
        if (ctx.context.reference) {
          return WalkAction.Replace([]);
        }
        let params = segment(node.params, " ");
        for (let param of params) {
          if (param.startsWith("source(")) {
            let path = param.slice(7, -1);
            if (path === "none") {
              root = path;
              continue;
            }
            if (path[0] === '"' && path[path.length - 1] !== '"' || path[0] === "'" && path[path.length - 1] !== "'" || path[0] !== "'" && path[0] !== '"') {
              throw new Error("`source(\u2026)` paths must be quoted.");
            }
            root = {
              base: ctx.context.sourceBase ?? ctx.context.base,
              pattern: path.slice(1, -1)
            };
          }
        }
        utilitiesNode = node;
        features |= 16 /* Utilities */;
      }
      if (node.name === "@utility") {
        if (ctx.parent !== null) {
          throw new Error("`@utility` cannot be nested.");
        }
        if (node.nodes.length === 0) {
          throw new Error(
            `\`@utility ${node.params}\` is empty. Utilities should include at least one property.`
          );
        }
        let utility = createCssUtility(node);
        if (utility === null) {
          if (!node.params.endsWith("-*")) {
            if (node.params.endsWith("*")) {
              throw new Error(
                `\`@utility ${node.params}\` defines an invalid utility name. A functional utility must end in \`-*\`.`
              );
            } else if (node.params.includes("*")) {
              throw new Error(
                `\`@utility ${node.params}\` defines an invalid utility name. The dynamic portion marked by \`-*\` must appear once at the end.`
              );
            }
          }
          throw new Error(
            `\`@utility ${node.params}\` defines an invalid utility name. Utilities should be alphanumeric and start with a lowercase letter.`
          );
        }
        customUtilities.push(utility);
      }
      if (node.name === "@source") {
        if (node.nodes.length > 0) {
          throw new Error("`@source` cannot have a body.");
        }
        if (ctx.parent !== null) {
          throw new Error("`@source` cannot be nested.");
        }
        let not = false;
        let inline = false;
        let path = node.params;
        if (path[0] === "n" && path.startsWith("not ")) {
          not = true;
          path = path.slice(4);
        }
        if (path[0] === "i" && path.startsWith("inline(")) {
          inline = true;
          path = path.slice(7, -1).trim();
        }
        if (path[0] === '"' && path[path.length - 1] !== '"' || path[0] === "'" && path[path.length - 1] !== "'" || path[0] !== "'" && path[0] !== '"') {
          throw new Error("`@source` paths must be quoted.");
        }
        let source = path.slice(1, -1);
        if (inline) {
          let destination = not ? ignoredCandidates : inlineCandidates;
          let sources2 = segment(source, " ");
          for (let source2 of sources2) {
            for (let candidate of expand(source2)) {
              destination.push(candidate);
            }
          }
        } else {
          sources.push({
            base: ctx.context.base,
            pattern: source,
            negated: not
          });
        }
        return WalkAction.ReplaceSkip([]);
      }
      if (node.name === "@variant") {
        if (ctx.parent === null) {
          if (node.nodes.length === 0) {
            node.name = "@custom-variant";
          } else {
            walk(node.nodes, (child) => {
              if (child.kind === "at-rule" && child.name === "@slot") {
                node.name = "@custom-variant";
                return WalkAction.Stop;
              }
            });
            if (node.name === "@variant") {
              variantNodes.push(node);
            }
          }
        } else {
          variantNodes.push(node);
        }
      }
      if (node.name === "@custom-variant") {
        if (ctx.parent !== null) {
          throw new Error("`@custom-variant` cannot be nested.");
        }
        let [name, selector2] = segment(node.params, " ");
        if (!IS_VALID_VARIANT_NAME.test(name)) {
          throw new Error(
            `\`@custom-variant ${name}\` defines an invalid variant name. Variants should only contain alphanumeric, dashes, or underscore characters and start with a lowercase letter or number.`
          );
        }
        if (node.nodes.length > 0 && selector2) {
          throw new Error(`\`@custom-variant ${name}\` cannot have both a selector and a body.`);
        }
        if (node.nodes.length === 0) {
          if (!selector2) {
            throw new Error(`\`@custom-variant ${name}\` has no selector or body.`);
          }
          let selectors = segment(selector2.slice(1, -1), ",");
          if (selectors.length === 0 || selectors.some((selector3) => selector3.trim() === "")) {
            throw new Error(
              `\`@custom-variant ${name} (${selectors.join(",")})\` selector is invalid.`
            );
          }
          let atRuleParams = [];
          let styleRuleSelectors = [];
          for (let selector3 of selectors) {
            selector3 = selector3.trim();
            if (selector3[0] === "@") {
              atRuleParams.push(selector3);
            } else {
              styleRuleSelectors.push(selector3);
            }
          }
          let usesAtScope = atRuleParams.some((param) => param.startsWith("@scope"));
          customVariants.set(name, (designSystem2) => {
            designSystem2.variants.static(
              name,
              (r) => {
                let slot = usesAtScope ? [context({ source: "user" }, r.nodes)] : r.nodes;
                let nodes = [];
                if (styleRuleSelectors.length > 0) {
                  nodes.push(styleRule(styleRuleSelectors.join(", "), slot));
                }
                for (let selector3 of atRuleParams) {
                  nodes.push(rule(selector3, slot));
                }
                r.nodes = usesAtScope ? [context({ source: "variant" }, nodes)] : nodes;
              },
              {
                compounds: compoundsForSelectors([...styleRuleSelectors, ...atRuleParams])
              }
            );
          });
          customVariantDependencies.set(name, /* @__PURE__ */ new Set());
        } else {
          let dependencies = /* @__PURE__ */ new Set();
          walk(node.nodes, (child) => {
            if (child.kind === "at-rule" && child.name === "@variant") {
              dependencies.add(child.params);
            }
          });
          customVariants.set(name, (designSystem2) => {
            designSystem2.variants.fromAst(name, node.nodes, designSystem2);
          });
          customVariantDependencies.set(name, dependencies);
        }
        return WalkAction.ReplaceSkip([]);
      }
      if (node.name === "@media") {
        let params = segment(node.params, " ");
        let unknownParams = [];
        for (let param of params) {
          if (param.startsWith("source(")) {
            let path = param.slice(7, -1);
            walk(node.nodes, (child) => {
              if (child.kind !== "at-rule") return;
              if (child.name === "@tailwind" && child.params === "utilities") {
                child.params += ` source(${path})`;
                return WalkAction.ReplaceStop([
                  context({ sourceBase: ctx.context.base }, [child])
                ]);
              }
            });
          } else if (param.startsWith("theme(")) {
            let themeParams = param.slice(6, -1);
            let hasReference = themeParams.includes("reference");
            walk(node.nodes, (child) => {
              if (child.kind === "context") return;
              if (child.kind !== "at-rule") {
                if (hasReference) {
                  throw new Error(
                    `Files imported with \`@import "\u2026" theme(reference)\` must only contain \`@theme\` blocks.
Use \`@reference "\u2026";\` instead.`
                  );
                }
                return WalkAction.Continue;
              }
              if (child.name === "@theme") {
                child.params += " " + themeParams;
                return WalkAction.Skip;
              }
            });
          } else if (param.startsWith("prefix(")) {
            let prefix = param.slice(7, -1);
            walk(node.nodes, (child) => {
              if (child.kind !== "at-rule") return;
              if (child.name === "@theme") {
                child.params += ` prefix(${prefix})`;
                return WalkAction.Skip;
              }
            });
          } else if (param === "important") {
            important = true;
          } else if (param === "reference") {
            node.nodes = [context({ reference: true }, node.nodes)];
          } else {
            unknownParams.push(param);
          }
        }
        if (unknownParams.length > 0) {
          node.params = unknownParams.join(" ");
        } else if (params.length > 0) {
          return WalkAction.Replace(node.nodes);
        }
        return WalkAction.Continue;
      }
      if (node.name === "@theme") {
        let [themeOptions, themePrefix] = parseThemeOptions(node.params);
        features |= 64 /* AtTheme */;
        if (ctx.context.reference) {
          themeOptions |= 2 /* REFERENCE */;
        }
        if (themePrefix) {
          if (!IS_VALID_PREFIX2.test(themePrefix)) {
            throw new Error(
              `The prefix "${themePrefix}" is invalid. Prefixes must be lowercase ASCII letters (a-z) only.`
            );
          }
          theme2.prefix = themePrefix;
        }
        walk(node.nodes, (child) => {
          if (child.kind === "at-rule" && child.name === "@keyframes") {
            theme2.addKeyframes(child);
            return WalkAction.Skip;
          }
          if (child.kind === "comment") return;
          if (child.kind === "declaration" && child.property.startsWith("--")) {
            theme2.add(unescape(child.property), child.value ?? "", themeOptions, child.src);
            return;
          }
          let snippet = toCss3([atRule(node.name, node.params, [child])]).split("\n").map((line, idx, all) => `${idx === 0 || idx >= all.length - 2 ? " " : ">"} ${line}`).join("\n");
          throw new Error(
            `\`@theme\` blocks must only contain custom properties or \`@keyframes\`.

${snippet}`
          );
        });
        if (!firstThemeRule) {
          firstThemeRule = styleRule(":root, :host", []);
          firstThemeRule.src = node.src;
          return WalkAction.ReplaceSkip(firstThemeRule);
        } else {
          return WalkAction.ReplaceSkip([]);
        }
      }
    });
    let designSystem = buildDesignSystem(theme2, utilitiesNode?.src);
    if (important) {
      designSystem.important = important;
    }
    if (ignoredCandidates.length > 0) {
      for (let candidate of ignoredCandidates) {
        designSystem.invalidCandidates.add(candidate);
      }
    }
    features |= await applyCompatibilityHooks({
      designSystem,
      base: base2,
      ast,
      loadModule,
      sources
    });
    for (let name of customVariants.keys()) {
      designSystem.variants.static(name, () => {
      });
    }
    for (let variant of topologicalSort(customVariantDependencies, {
      onCircularDependency(path, start) {
        let output = toCss3(
          path.map((name, idx) => {
            return atRule("@custom-variant", name, [atRule("@variant", path[idx + 1] ?? start, [])]);
          })
        ).replaceAll(";", " { \u2026 }").replace(`@custom-variant ${start} {`, `@custom-variant ${start} { /* \u2190 */`);
        throw new Error(`Circular dependency detected in custom variants:

${output}`);
      }
    })) {
      customVariants.get(variant)?.(designSystem);
    }
    for (let customUtility of customUtilities) {
      customUtility(designSystem);
    }
    if (firstThemeRule) {
      let nodes = [];
      for (let [key, value2] of designSystem.theme.entries()) {
        if (value2.options & 2 /* REFERENCE */) continue;
        let node = decl(escape(key), value2.value);
        node.src = value2.src;
        nodes.push(node);
      }
      let keyframesRules = designSystem.theme.getKeyframes();
      for (let keyframes of keyframesRules) {
        ast.push(context({ theme: true }, [atRoot([keyframes])]));
      }
      firstThemeRule.nodes = [context({ theme: true }, nodes)];
    }
    features |= substituteAtVariant(ast, designSystem);
    features |= substituteFunctions(ast, designSystem);
    features |= substituteAtApply(ast, designSystem);
    if (utilitiesNode) {
      let node = utilitiesNode;
      node.kind = "context";
      node.context = {};
    }
    walk(ast, (node) => {
      if (node.kind !== "at-rule") return;
      if (node.name === "@utility") {
        return WalkAction.Replace([]);
      }
      return WalkAction.Skip;
    });
    return {
      designSystem,
      ast,
      sources,
      root,
      utilitiesNode,
      features,
      inlineCandidates
    };
  }
  async function compileAst(input, opts = {}) {
    let { designSystem, ast, sources, root, utilitiesNode, features, inlineCandidates } = await parseCss(input, opts);
    if (true) {
      ast.unshift(comment(`! tailwindcss v${version} | MIT License | https://tailwindcss.com `));
    }
    function onInvalidCandidate(candidate) {
      designSystem.invalidCandidates.add(candidate);
    }
    let allValidCandidates = /* @__PURE__ */ new Set();
    let compiled = null;
    let previousAstNodeCount = 0;
    let defaultDidChange = false;
    for (let candidate of inlineCandidates) {
      if (!designSystem.invalidCandidates.has(candidate)) {
        allValidCandidates.add(candidate);
        defaultDidChange = true;
      }
    }
    return {
      sources,
      root,
      features,
      build(newRawCandidates) {
        if (features === 0 /* None */) {
          return input;
        }
        if (!utilitiesNode) {
          compiled ??= optimizeAst(ast, designSystem, opts.polyfills);
          return compiled;
        }
        let didChange = defaultDidChange;
        let didAddExternalVariable = false;
        defaultDidChange = false;
        let prevSize = allValidCandidates.size;
        for (let candidate of newRawCandidates) {
          if (!designSystem.invalidCandidates.has(candidate)) {
            if (candidate[0] === "-" && candidate[1] === "-") {
              let didMarkVariableAsUsed = designSystem.theme.markUsedVariable(candidate);
              didChange ||= didMarkVariableAsUsed;
              didAddExternalVariable ||= didMarkVariableAsUsed;
            } else {
              allValidCandidates.add(candidate);
              didChange ||= allValidCandidates.size !== prevSize;
            }
          }
        }
        if (!didChange) {
          compiled ??= optimizeAst(ast, designSystem, opts.polyfills);
          return compiled;
        }
        let newNodes = compileCandidates(allValidCandidates, designSystem, {
          onInvalidCandidate
        }).astNodes;
        if (opts.from) {
          walk(newNodes, (node) => {
            node.src ??= utilitiesNode.src;
          });
        }
        if (!didAddExternalVariable && previousAstNodeCount === newNodes.length) {
          compiled ??= optimizeAst(ast, designSystem, opts.polyfills);
          return compiled;
        }
        previousAstNodeCount = newNodes.length;
        utilitiesNode.nodes = newNodes;
        compiled = optimizeAst(ast, designSystem, opts.polyfills);
        return compiled;
      }
    };
  }
  async function compile(css, opts = {}) {
    let ast = parse2(css, { from: opts.from });
    let api = await compileAst(ast, opts);
    let compiledAst = ast;
    let compiledCss = css;
    return {
      ...api,
      build(newCandidates) {
        let newAst = api.build(newCandidates);
        if (newAst === compiledAst) {
          return compiledCss;
        }
        compiledCss = toCss3(newAst, !!opts.from);
        compiledAst = newAst;
        return compiledCss;
      },
      buildSourceMap() {
        return createSourceMap({
          ast: compiledAst
        });
      }
    };
  }

  // vendor/package/functions/themeOrder.js
  var themeOrder_default = [
    "light",
    "dark",
    "cupcake",
    "bumblebee",
    "emerald",
    "corporate",
    "synthwave",
    "retro",
    "cyberpunk",
    "valentine",
    "halloween",
    "garden",
    "forest",
    "aqua",
    "lofi",
    "pastel",
    "fantasy",
    "wireframe",
    "black",
    "luxury",
    "dracula",
    "cmyk",
    "autumn",
    "business",
    "acid",
    "lemonade",
    "night",
    "coffee",
    "winter",
    "dim",
    "nord",
    "sunset",
    "caramellatte",
    "abyss",
    "silk"
  ];

  // vendor/package/functions/pluginOptionsHandler.js
  var pluginOptionsHandler = /* @__PURE__ */ (() => {
    let firstRun = true;
    return (options, addBase, themesObject, packageVersion) => {
      const {
        logs = true,
        root = ":root",
        themes = ["light --default", "dark --prefersdark"],
        include,
        exclude,
        prefix = ""
      } = options || {};
      if (logs !== false && firstRun) {
        console.log(
          `${atob("Lyoh")} ${decodeURIComponent("%F0%9F%8C%BC")} ${atob("ZGFpc3lVSQ==")} ${packageVersion} ${atob("Ki8=")}`
        );
        firstRun = false;
      }
      const applyTheme = (themeName, flags) => {
        const theme2 = themesObject[themeName];
        if (theme2) {
          const themeControllerClass = `${prefix}theme-controller`;
          let selector2 = `${root}:has(input.${themeControllerClass}[value=${themeName}]:checked),[data-theme=${themeName}]`;
          if (flags.includes("--default")) {
            selector2 = `:where(${root}),${selector2}`;
          }
          addBase({ [selector2]: theme2 });
          if (flags.includes("--prefersdark")) {
            const darkSelector = root === ":root" ? ":root:not([data-theme])" : `${root}:not([data-theme])`;
            addBase({ "@media (prefers-color-scheme: dark)": { [darkSelector]: theme2 } });
          }
        }
      };
      if (themes === "all") {
        if (themesObject["light"]) {
          applyTheme("light", ["--default"]);
        }
        if (themesObject["dark"]) {
          const darkSelector = root === ":root" ? ":root:not([data-theme])" : `${root}:not([data-theme])`;
          addBase({ "@media (prefers-color-scheme: dark)": { [darkSelector]: themesObject["dark"] } });
        }
        themeOrder_default.forEach((themeName) => {
          if (themesObject[themeName]) {
            applyTheme(themeName, []);
          }
        });
      } else if (themes) {
        const themeArray = Array.isArray(themes) ? themes : [themes];
        if (themeArray.length === 1 && themeArray[0].includes("--default")) {
          const [themeName, ...flags] = themeArray[0].split(" ");
          applyTheme(themeName, flags);
          return { include, exclude, prefix };
        }
        themeArray.forEach((themeOption) => {
          const [themeName, ...flags] = themeOption.split(" ");
          if (flags.includes("--default")) {
            applyTheme(themeName, ["--default"]);
          }
        });
        themeArray.forEach((themeOption) => {
          const [themeName, ...flags] = themeOption.split(" ");
          if (flags.includes("--prefersdark")) {
            const darkSelector = root === ":root" ? ":root:not([data-theme])" : `${root}:not([data-theme])`;
            addBase({
              "@media (prefers-color-scheme: dark)": { [darkSelector]: themesObject[themeName] }
            });
          }
        });
        themeArray.forEach((themeOption) => {
          const [themeName] = themeOption.split(" ");
          applyTheme(themeName, []);
        });
      }
      return { include, exclude, prefix };
    };
  })();

  // vendor/package/functions/plugin.js
  var plugin = {
    withOptions: (pluginFunction, configFunction = () => ({})) => {
      const optionsFunction = (options) => {
        const handler = pluginFunction(options);
        const config = configFunction(options);
        return { handler, config };
      };
      optionsFunction.__isOptionsFunction = true;
      return optionsFunction;
    }
  };

  // vendor/package/functions/nestCssLayers.js
  var appendRule = (styles, selector2, rule2) => {
    const currentRule = styles[selector2];
    if (currentRule === void 0) {
      styles[selector2] = rule2;
      return;
    }
    styles[selector2] = Array.isArray(currentRule) ? [...currentRule, rule2] : [currentRule, rule2];
  };
  var wrapWithAtRules = (rule2, atRules) => atRules.reduceRight((wrappedRule, atRule2) => ({ [atRule2]: wrappedRule }), rule2);
  var moveLayerRules = (styles, layerValue, atRules) => {
    const layerBlocks = Array.isArray(layerValue) ? layerValue : [layerValue];
    for (const layerBlock of layerBlocks) {
      for (const [key, value2] of Object.entries(layerBlock)) {
        if (key.startsWith("@")) {
          moveLayerRules(styles, value2, [...atRules, key]);
          continue;
        }
        appendRule(styles, key, wrapWithAtRules(value2, atRules));
      }
    }
  };
  var nestCssLayers = (styles) => {
    const nestedStyles = {};
    for (const [key, value2] of Object.entries(styles)) {
      if (key.startsWith("@layer ")) {
        moveLayerRules(nestedStyles, value2, [key]);
        continue;
      }
      appendRule(nestedStyles, key, value2);
    }
    return nestedStyles;
  };

  // vendor/package/functions/variables.js
  var variables_default = {
    colors: {
      "base-100": "var(--color-base-100)",
      "base-200": "var(--color-base-200)",
      "base-300": "var(--color-base-300)",
      "base-content": "var(--color-base-content)",
      primary: "var(--color-primary)",
      "primary-content": "var(--color-primary-content)",
      secondary: "var(--color-secondary)",
      "secondary-content": "var(--color-secondary-content)",
      accent: "var(--color-accent)",
      "accent-content": "var(--color-accent-content)",
      neutral: "var(--color-neutral)",
      "neutral-content": "var(--color-neutral-content)",
      info: "var(--color-info)",
      "info-content": "var(--color-info-content)",
      success: "var(--color-success)",
      "success-content": "var(--color-success-content)",
      warning: "var(--color-warning)",
      "warning-content": "var(--color-warning-content)",
      error: "var(--color-error)",
      "error-content": "var(--color-error-content)"
    },
    borderRadius: {
      selector: "var(--radius-selector)",
      field: "var(--radius-field)",
      box: "var(--radius-box)"
    }
  };

  // vendor/package/theme/object.js
  var object_default = { "dim": { "color-scheme": "dark", "--color-base-100": "oklch(30.857% 0.023 264.149)", "--color-base-200": "oklch(28.036% 0.019 264.182)", "--color-base-300": "oklch(26.346% 0.018 262.177)", "--color-base-content": "oklch(82.901% 0.031 222.959)", "--color-primary": "oklch(86.133% 0.141 139.549)", "--color-primary-content": "oklch(17.226% 0.028 139.549)", "--color-secondary": "oklch(73.375% 0.165 35.353)", "--color-secondary-content": "oklch(14.675% 0.033 35.353)", "--color-accent": "oklch(74.229% 0.133 311.379)", "--color-accent-content": "oklch(14.845% 0.026 311.379)", "--color-neutral": "oklch(24.731% 0.02 264.094)", "--color-neutral-content": "oklch(82.901% 0.031 222.959)", "--color-info": "oklch(86.078% 0.142 206.182)", "--color-info-content": "oklch(17.215% 0.028 206.182)", "--color-success": "oklch(86.171% 0.142 166.534)", "--color-success-content": "oklch(17.234% 0.028 166.534)", "--color-warning": "oklch(86.163% 0.142 94.818)", "--color-warning-content": "oklch(17.232% 0.028 94.818)", "--color-error": "oklch(82.418% 0.099 33.756)", "--color-error-content": "oklch(16.483% 0.019 33.756)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "nord": { "color-scheme": "light", "--color-base-100": "oklch(95.127% 0.007 260.731)", "--color-base-200": "oklch(93.299% 0.01 261.788)", "--color-base-300": "oklch(89.925% 0.016 262.749)", "--color-base-content": "oklch(32.437% 0.022 264.182)", "--color-primary": "oklch(59.435% 0.077 254.027)", "--color-primary-content": "oklch(11.887% 0.015 254.027)", "--color-secondary": "oklch(69.651% 0.059 248.687)", "--color-secondary-content": "oklch(13.93% 0.011 248.687)", "--color-accent": "oklch(77.464% 0.062 217.469)", "--color-accent-content": "oklch(15.492% 0.012 217.469)", "--color-neutral": "oklch(45.229% 0.035 264.131)", "--color-neutral-content": "oklch(89.925% 0.016 262.749)", "--color-info": "oklch(69.207% 0.062 332.664)", "--color-info-content": "oklch(13.841% 0.012 332.664)", "--color-success": "oklch(76.827% 0.074 131.063)", "--color-success-content": "oklch(15.365% 0.014 131.063)", "--color-warning": "oklch(85.486% 0.089 84.093)", "--color-warning-content": "oklch(17.097% 0.017 84.093)", "--color-error": "oklch(60.61% 0.12 15.341)", "--color-error-content": "oklch(12.122% 0.024 15.341)", "--radius-selector": "1rem", "--radius-field": "0.25rem", "--radius-box": "0.5rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "fantasy": { "color-scheme": "light", "--color-base-100": "oklch(100% 0 0)", "--color-base-200": "oklch(93% 0 0)", "--color-base-300": "oklch(86% 0 0)", "--color-base-content": "oklch(27.807% 0.029 256.847)", "--color-primary": "oklch(37.45% 0.189 325.02)", "--color-primary-content": "oklch(87.49% 0.037 325.02)", "--color-secondary": "oklch(53.92% 0.162 241.36)", "--color-secondary-content": "oklch(90.784% 0.032 241.36)", "--color-accent": "oklch(75.98% 0.204 56.72)", "--color-accent-content": "oklch(15.196% 0.04 56.72)", "--color-neutral": "oklch(27.807% 0.029 256.847)", "--color-neutral-content": "oklch(85.561% 0.005 256.847)", "--color-info": "oklch(72.06% 0.191 231.6)", "--color-info-content": "oklch(0% 0 0)", "--color-success": "oklch(64.8% 0.15 160)", "--color-success-content": "oklch(0% 0 0)", "--color-warning": "oklch(84.71% 0.199 83.87)", "--color-warning-content": "oklch(0% 0 0)", "--color-error": "oklch(71.76% 0.221 22.18)", "--color-error-content": "oklch(0% 0 0)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "1", "--noise": "0" }, "cmyk": { "color-scheme": "light", "--color-base-100": "oklch(100% 0 0)", "--color-base-200": "oklch(95% 0 0)", "--color-base-300": "oklch(90% 0 0)", "--color-base-content": "oklch(20% 0 0)", "--color-primary": "oklch(71.772% 0.133 239.443)", "--color-primary-content": "oklch(14.354% 0.026 239.443)", "--color-secondary": "oklch(64.476% 0.202 359.339)", "--color-secondary-content": "oklch(12.895% 0.04 359.339)", "--color-accent": "oklch(94.228% 0.189 105.306)", "--color-accent-content": "oklch(18.845% 0.037 105.306)", "--color-neutral": "oklch(21.778% 0 0)", "--color-neutral-content": "oklch(84.355% 0 0)", "--color-info": "oklch(68.475% 0.094 217.284)", "--color-info-content": "oklch(13.695% 0.018 217.284)", "--color-success": "oklch(46.949% 0.162 321.406)", "--color-success-content": "oklch(89.389% 0.032 321.406)", "--color-warning": "oklch(71.236% 0.159 52.023)", "--color-warning-content": "oklch(14.247% 0.031 52.023)", "--color-error": "oklch(62.013% 0.208 28.717)", "--color-error-content": "oklch(12.402% 0.041 28.717)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "light": { "color-scheme": "light", "--color-base-100": "oklch(100% 0 0)", "--color-base-200": "oklch(98% 0 0)", "--color-base-300": "oklch(95% 0 0)", "--color-base-content": "oklch(21% 0.006 285.885)", "--color-primary": "oklch(45% 0.24 277.023)", "--color-primary-content": "oklch(93% 0.034 272.788)", "--color-secondary": "oklch(65% 0.241 354.308)", "--color-secondary-content": "oklch(94% 0.028 342.258)", "--color-accent": "oklch(77% 0.152 181.912)", "--color-accent-content": "oklch(38% 0.063 188.416)", "--color-neutral": "oklch(14% 0.005 285.823)", "--color-neutral-content": "oklch(92% 0.004 286.32)", "--color-info": "oklch(74% 0.16 232.661)", "--color-info-content": "oklch(29% 0.066 243.157)", "--color-success": "oklch(76% 0.177 163.223)", "--color-success-content": "oklch(37% 0.077 168.94)", "--color-warning": "oklch(82% 0.189 84.429)", "--color-warning-content": "oklch(41% 0.112 45.904)", "--color-error": "oklch(71% 0.194 13.428)", "--color-error-content": "oklch(27% 0.105 12.094)", "--radius-selector": "0.5rem", "--radius-field": "0.25rem", "--radius-box": "0.5rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "1", "--noise": "0" }, "pastel": { "color-scheme": "light", "--color-base-100": "oklch(100% 0 0)", "--color-base-200": "oklch(98.462% 0.001 247.838)", "--color-base-300": "oklch(92.462% 0.001 247.838)", "--color-base-content": "oklch(20% 0 0)", "--color-primary": "oklch(90% 0.063 306.703)", "--color-primary-content": "oklch(49% 0.265 301.924)", "--color-secondary": "oklch(89% 0.058 10.001)", "--color-secondary-content": "oklch(51% 0.222 16.935)", "--color-accent": "oklch(90% 0.093 164.15)", "--color-accent-content": "oklch(50% 0.118 165.612)", "--color-neutral": "oklch(55% 0.046 257.417)", "--color-neutral-content": "oklch(92% 0.013 255.508)", "--color-info": "oklch(86% 0.127 207.078)", "--color-info-content": "oklch(52% 0.105 223.128)", "--color-success": "oklch(87% 0.15 154.449)", "--color-success-content": "oklch(52% 0.154 150.069)", "--color-warning": "oklch(83% 0.128 66.29)", "--color-warning-content": "oklch(55% 0.195 38.402)", "--color-error": "oklch(80% 0.114 19.571)", "--color-error-content": "oklch(50% 0.213 27.518)", "--radius-selector": "1rem", "--radius-field": "2rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "2px", "--depth": "0", "--noise": "0" }, "acid": { "color-scheme": "light", "--color-base-100": "oklch(98% 0 0)", "--color-base-200": "oklch(95% 0 0)", "--color-base-300": "oklch(91% 0 0)", "--color-base-content": "oklch(0% 0 0)", "--color-primary": "oklch(71.9% 0.357 330.759)", "--color-primary-content": "oklch(14.38% 0.071 330.759)", "--color-secondary": "oklch(73.37% 0.224 48.25)", "--color-secondary-content": "oklch(14.674% 0.044 48.25)", "--color-accent": "oklch(92.78% 0.264 122.962)", "--color-accent-content": "oklch(18.556% 0.052 122.962)", "--color-neutral": "oklch(21.31% 0.128 278.68)", "--color-neutral-content": "oklch(84.262% 0.025 278.68)", "--color-info": "oklch(60.72% 0.227 252.05)", "--color-info-content": "oklch(12.144% 0.045 252.05)", "--color-success": "oklch(85.72% 0.266 158.53)", "--color-success-content": "oklch(17.144% 0.053 158.53)", "--color-warning": "oklch(91.01% 0.212 100.5)", "--color-warning-content": "oklch(18.202% 0.042 100.5)", "--color-error": "oklch(64.84% 0.293 29.349)", "--color-error-content": "oklch(12.968% 0.058 29.349)", "--radius-selector": "1rem", "--radius-field": "1rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "1", "--noise": "0" }, "wireframe": { "color-scheme": "light", "--color-base-100": "oklch(100% 0 0)", "--color-base-200": "oklch(97% 0 0)", "--color-base-300": "oklch(94% 0 0)", "--color-base-content": "oklch(20% 0 0)", "--color-primary": "oklch(87% 0 0)", "--color-primary-content": "oklch(26% 0 0)", "--color-secondary": "oklch(87% 0 0)", "--color-secondary-content": "oklch(26% 0 0)", "--color-accent": "oklch(87% 0 0)", "--color-accent-content": "oklch(26% 0 0)", "--color-neutral": "oklch(87% 0 0)", "--color-neutral-content": "oklch(26% 0 0)", "--color-info": "oklch(44% 0.11 240.79)", "--color-info-content": "oklch(90% 0.058 230.902)", "--color-success": "oklch(43% 0.095 166.913)", "--color-success-content": "oklch(90% 0.093 164.15)", "--color-warning": "oklch(47% 0.137 46.201)", "--color-warning-content": "oklch(92% 0.12 95.746)", "--color-error": "oklch(44% 0.177 26.899)", "--color-error-content": "oklch(88% 0.062 18.334)", "--radius-selector": "0rem", "--radius-field": "0.25rem", "--radius-box": "0.25rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "coffee": { "color-scheme": "dark", "--color-base-100": "oklch(24% 0.023 329.708)", "--color-base-200": "oklch(21% 0.021 329.708)", "--color-base-300": "oklch(16% 0.019 329.708)", "--color-base-content": "oklch(72.354% 0.092 79.129)", "--color-primary": "oklch(71.996% 0.123 62.756)", "--color-primary-content": "oklch(14.399% 0.024 62.756)", "--color-secondary": "oklch(34.465% 0.029 199.194)", "--color-secondary-content": "oklch(86.893% 0.005 199.194)", "--color-accent": "oklch(42.621% 0.074 224.389)", "--color-accent-content": "oklch(88.524% 0.014 224.389)", "--color-neutral": "oklch(16.51% 0.015 326.261)", "--color-neutral-content": "oklch(83.302% 0.003 326.261)", "--color-info": "oklch(79.49% 0.063 184.558)", "--color-info-content": "oklch(15.898% 0.012 184.558)", "--color-success": "oklch(74.722% 0.072 131.116)", "--color-success-content": "oklch(14.944% 0.014 131.116)", "--color-warning": "oklch(88.15% 0.14 87.722)", "--color-warning-content": "oklch(17.63% 0.028 87.722)", "--color-error": "oklch(77.318% 0.128 31.871)", "--color-error-content": "oklch(15.463% 0.025 31.871)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "night": { "color-scheme": "dark", "--color-base-100": "oklch(20.768% 0.039 265.754)", "--color-base-200": "oklch(19.314% 0.037 265.754)", "--color-base-300": "oklch(17.86% 0.034 265.754)", "--color-base-content": "oklch(84.153% 0.007 265.754)", "--color-primary": "oklch(75.351% 0.138 232.661)", "--color-primary-content": "oklch(15.07% 0.027 232.661)", "--color-secondary": "oklch(68.011% 0.158 276.934)", "--color-secondary-content": "oklch(13.602% 0.031 276.934)", "--color-accent": "oklch(72.36% 0.176 350.048)", "--color-accent-content": "oklch(14.472% 0.035 350.048)", "--color-neutral": "oklch(27.949% 0.036 260.03)", "--color-neutral-content": "oklch(85.589% 0.007 260.03)", "--color-info": "oklch(68.455% 0.148 237.251)", "--color-info-content": "oklch(0% 0 0)", "--color-success": "oklch(78.452% 0.132 181.911)", "--color-success-content": "oklch(15.69% 0.026 181.911)", "--color-warning": "oklch(83.242% 0.139 82.95)", "--color-warning-content": "oklch(16.648% 0.027 82.95)", "--color-error": "oklch(71.785% 0.17 13.118)", "--color-error-content": "oklch(14.357% 0.034 13.118)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "cupcake": { "color-scheme": "light", "--color-base-100": "oklch(97.788% 0.004 56.375)", "--color-base-200": "oklch(93.982% 0.007 61.449)", "--color-base-300": "oklch(91.586% 0.006 53.44)", "--color-base-content": "oklch(23.574% 0.066 313.189)", "--color-primary": "oklch(85% 0.138 181.071)", "--color-primary-content": "oklch(43% 0.078 188.216)", "--color-secondary": "oklch(89% 0.061 343.231)", "--color-secondary-content": "oklch(45% 0.187 3.815)", "--color-accent": "oklch(90% 0.076 70.697)", "--color-accent-content": "oklch(47% 0.157 37.304)", "--color-neutral": "oklch(27% 0.006 286.033)", "--color-neutral-content": "oklch(92% 0.004 286.32)", "--color-info": "oklch(68% 0.169 237.323)", "--color-info-content": "oklch(29% 0.066 243.157)", "--color-success": "oklch(69% 0.17 162.48)", "--color-success-content": "oklch(26% 0.051 172.552)", "--color-warning": "oklch(79% 0.184 86.047)", "--color-warning-content": "oklch(28% 0.066 53.813)", "--color-error": "oklch(64% 0.246 16.439)", "--color-error-content": "oklch(27% 0.105 12.094)", "--radius-selector": "1rem", "--radius-field": "2rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "2px", "--depth": "1", "--noise": "0" }, "synthwave": { "color-scheme": "dark", "--color-base-100": "oklch(15% 0.09 281.288)", "--color-base-200": "oklch(20% 0.09 281.288)", "--color-base-300": "oklch(25% 0.09 281.288)", "--color-base-content": "oklch(78% 0.115 274.713)", "--color-primary": "oklch(71% 0.202 349.761)", "--color-primary-content": "oklch(28% 0.109 3.907)", "--color-secondary": "oklch(82% 0.111 230.318)", "--color-secondary-content": "oklch(29% 0.066 243.157)", "--color-accent": "oklch(75% 0.183 55.934)", "--color-accent-content": "oklch(26% 0.079 36.259)", "--color-neutral": "oklch(45% 0.24 277.023)", "--color-neutral-content": "oklch(87% 0.065 274.039)", "--color-info": "oklch(74% 0.16 232.661)", "--color-info-content": "oklch(29% 0.066 243.157)", "--color-success": "oklch(77% 0.152 181.912)", "--color-success-content": "oklch(27% 0.046 192.524)", "--color-warning": "oklch(90% 0.182 98.111)", "--color-warning-content": "oklch(42% 0.095 57.708)", "--color-error": "oklch(73.7% 0.121 32.639)", "--color-error-content": "oklch(23.501% 0.096 290.329)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "sunset": { "color-scheme": "dark", "--color-base-100": "oklch(22% 0.019 237.69)", "--color-base-200": "oklch(20% 0.019 237.69)", "--color-base-300": "oklch(18% 0.019 237.69)", "--color-base-content": "oklch(77.383% 0.043 245.096)", "--color-primary": "oklch(74.703% 0.158 39.947)", "--color-primary-content": "oklch(14.94% 0.031 39.947)", "--color-secondary": "oklch(72.537% 0.177 2.72)", "--color-secondary-content": "oklch(14.507% 0.035 2.72)", "--color-accent": "oklch(71.294% 0.166 299.844)", "--color-accent-content": "oklch(14.258% 0.033 299.844)", "--color-neutral": "oklch(26% 0.019 237.69)", "--color-neutral-content": "oklch(70% 0.019 237.69)", "--color-info": "oklch(85.559% 0.085 206.015)", "--color-info-content": "oklch(17.111% 0.017 206.015)", "--color-success": "oklch(85.56% 0.085 144.778)", "--color-success-content": "oklch(17.112% 0.017 144.778)", "--color-warning": "oklch(85.569% 0.084 74.427)", "--color-warning-content": "oklch(17.113% 0.016 74.427)", "--color-error": "oklch(85.511% 0.078 16.886)", "--color-error-content": "oklch(17.102% 0.015 16.886)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "winter": { "color-scheme": "light", "--color-base-100": "oklch(100% 0 0)", "--color-base-200": "oklch(97.466% 0.011 259.822)", "--color-base-300": "oklch(93.268% 0.016 262.751)", "--color-base-content": "oklch(41.886% 0.053 255.824)", "--color-primary": "oklch(56.86% 0.255 257.57)", "--color-primary-content": "oklch(91.372% 0.051 257.57)", "--color-secondary": "oklch(42.551% 0.161 282.339)", "--color-secondary-content": "oklch(88.51% 0.032 282.339)", "--color-accent": "oklch(59.939% 0.191 335.171)", "--color-accent-content": "oklch(11.988% 0.038 335.171)", "--color-neutral": "oklch(19.616% 0.063 257.651)", "--color-neutral-content": "oklch(83.923% 0.012 257.651)", "--color-info": "oklch(88.127% 0.085 214.515)", "--color-info-content": "oklch(17.625% 0.017 214.515)", "--color-success": "oklch(80.494% 0.077 197.823)", "--color-success-content": "oklch(16.098% 0.015 197.823)", "--color-warning": "oklch(89.172% 0.045 71.47)", "--color-warning-content": "oklch(17.834% 0.009 71.47)", "--color-error": "oklch(73.092% 0.11 20.076)", "--color-error-content": "oklch(14.618% 0.022 20.076)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "garden": { "color-scheme": "light", "--color-base-100": "oklch(92.951% 0.002 17.197)", "--color-base-200": "oklch(86.445% 0.002 17.197)", "--color-base-300": "oklch(79.938% 0.001 17.197)", "--color-base-content": "oklch(16.961% 0.001 17.32)", "--color-primary": "oklch(62.45% 0.278 3.836)", "--color-primary-content": "oklch(100% 0 0)", "--color-secondary": "oklch(48.495% 0.11 355.095)", "--color-secondary-content": "oklch(89.699% 0.022 355.095)", "--color-accent": "oklch(56.273% 0.054 154.39)", "--color-accent-content": "oklch(100% 0 0)", "--color-neutral": "oklch(24.155% 0.049 89.07)", "--color-neutral-content": "oklch(92.951% 0.002 17.197)", "--color-info": "oklch(72.06% 0.191 231.6)", "--color-info-content": "oklch(0% 0 0)", "--color-success": "oklch(64.8% 0.15 160)", "--color-success-content": "oklch(0% 0 0)", "--color-warning": "oklch(84.71% 0.199 83.87)", "--color-warning-content": "oklch(0% 0 0)", "--color-error": "oklch(71.76% 0.221 22.18)", "--color-error-content": "oklch(0% 0 0)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "luxury": { "color-scheme": "dark", "--color-base-100": "oklch(14.076% 0.004 285.822)", "--color-base-200": "oklch(20.219% 0.004 308.229)", "--color-base-300": "oklch(23.219% 0.004 308.229)", "--color-base-content": "oklch(75.687% 0.123 76.89)", "--color-primary": "oklch(100% 0 0)", "--color-primary-content": "oklch(20% 0 0)", "--color-secondary": "oklch(27.581% 0.064 261.069)", "--color-secondary-content": "oklch(85.516% 0.012 261.069)", "--color-accent": "oklch(36.674% 0.051 338.825)", "--color-accent-content": "oklch(87.334% 0.01 338.825)", "--color-neutral": "oklch(24.27% 0.057 59.825)", "--color-neutral-content": "oklch(93.203% 0.089 90.861)", "--color-info": "oklch(79.061% 0.121 237.133)", "--color-info-content": "oklch(15.812% 0.024 237.133)", "--color-success": "oklch(78.119% 0.192 132.154)", "--color-success-content": "oklch(15.623% 0.038 132.154)", "--color-warning": "oklch(86.127% 0.136 102.891)", "--color-warning-content": "oklch(17.225% 0.027 102.891)", "--color-error": "oklch(71.753% 0.176 22.568)", "--color-error-content": "oklch(14.35% 0.035 22.568)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "1", "--noise": "0" }, "retro": { "color-scheme": "light", "--color-base-100": "oklch(91.637% 0.034 90.515)", "--color-base-200": "oklch(88.272% 0.049 91.774)", "--color-base-300": "oklch(84.133% 0.065 90.856)", "--color-base-content": "oklch(41% 0.112 45.904)", "--color-primary": "oklch(80% 0.114 19.571)", "--color-primary-content": "oklch(39% 0.141 25.723)", "--color-secondary": "oklch(92% 0.084 155.995)", "--color-secondary-content": "oklch(44% 0.119 151.328)", "--color-accent": "oklch(68% 0.162 75.834)", "--color-accent-content": "oklch(41% 0.112 45.904)", "--color-neutral": "oklch(44% 0.011 73.639)", "--color-neutral-content": "oklch(86% 0.005 56.366)", "--color-info": "oklch(58% 0.158 241.966)", "--color-info-content": "oklch(96% 0.059 95.617)", "--color-success": "oklch(51% 0.096 186.391)", "--color-success-content": "oklch(96% 0.059 95.617)", "--color-warning": "oklch(64% 0.222 41.116)", "--color-warning-content": "oklch(96% 0.059 95.617)", "--color-error": "oklch(70% 0.191 22.216)", "--color-error-content": "oklch(40% 0.123 38.172)", "--radius-selector": "0.25rem", "--radius-field": "0.25rem", "--radius-box": "0.5rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "aqua": { "color-scheme": "dark", "--color-base-100": "oklch(37% 0.146 265.522)", "--color-base-200": "oklch(28% 0.091 267.935)", "--color-base-300": "oklch(22% 0.091 267.935)", "--color-base-content": "oklch(90% 0.058 230.902)", "--color-primary": "oklch(85.661% 0.144 198.645)", "--color-primary-content": "oklch(40.124% 0.068 197.603)", "--color-secondary": "oklch(60.682% 0.108 309.782)", "--color-secondary-content": "oklch(96% 0.016 293.756)", "--color-accent": "oklch(93.426% 0.102 94.555)", "--color-accent-content": "oklch(18.685% 0.02 94.555)", "--color-neutral": "oklch(27% 0.146 265.522)", "--color-neutral-content": "oklch(80% 0.146 265.522)", "--color-info": "oklch(54.615% 0.215 262.88)", "--color-info-content": "oklch(90.923% 0.043 262.88)", "--color-success": "oklch(62.705% 0.169 149.213)", "--color-success-content": "oklch(12.541% 0.033 149.213)", "--color-warning": "oklch(66.584% 0.157 58.318)", "--color-warning-content": "oklch(27% 0.077 45.635)", "--color-error": "oklch(73.95% 0.19 27.33)", "--color-error-content": "oklch(14.79% 0.038 27.33)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "1", "--noise": "0" }, "bumblebee": { "color-scheme": "light", "--color-base-100": "oklch(100% 0 0)", "--color-base-200": "oklch(97% 0 0)", "--color-base-300": "oklch(92% 0 0)", "--color-base-content": "oklch(20% 0 0)", "--color-primary": "oklch(85% 0.199 91.936)", "--color-primary-content": "oklch(42% 0.095 57.708)", "--color-secondary": "oklch(75% 0.183 55.934)", "--color-secondary-content": "oklch(40% 0.123 38.172)", "--color-accent": "oklch(0% 0 0)", "--color-accent-content": "oklch(100% 0 0)", "--color-neutral": "oklch(37% 0.01 67.558)", "--color-neutral-content": "oklch(92% 0.003 48.717)", "--color-info": "oklch(74% 0.16 232.661)", "--color-info-content": "oklch(39% 0.09 240.876)", "--color-success": "oklch(76% 0.177 163.223)", "--color-success-content": "oklch(37% 0.077 168.94)", "--color-warning": "oklch(82% 0.189 84.429)", "--color-warning-content": "oklch(41% 0.112 45.904)", "--color-error": "oklch(70% 0.191 22.216)", "--color-error-content": "oklch(39% 0.141 25.723)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "1", "--noise": "0" }, "dracula": { "color-scheme": "dark", "--color-base-100": "oklch(28.822% 0.022 277.508)", "--color-base-200": "oklch(26.805% 0.02 277.508)", "--color-base-300": "oklch(24.787% 0.019 277.508)", "--color-base-content": "oklch(97.747% 0.007 106.545)", "--color-primary": "oklch(75.461% 0.183 346.812)", "--color-primary-content": "oklch(15.092% 0.036 346.812)", "--color-secondary": "oklch(74.202% 0.148 301.883)", "--color-secondary-content": "oklch(14.84% 0.029 301.883)", "--color-accent": "oklch(83.392% 0.124 66.558)", "--color-accent-content": "oklch(16.678% 0.024 66.558)", "--color-neutral": "oklch(39.445% 0.032 275.524)", "--color-neutral-content": "oklch(87.889% 0.006 275.524)", "--color-info": "oklch(88.263% 0.093 212.846)", "--color-info-content": "oklch(17.652% 0.018 212.846)", "--color-success": "oklch(87.099% 0.219 148.024)", "--color-success-content": "oklch(17.419% 0.043 148.024)", "--color-warning": "oklch(95.533% 0.134 112.757)", "--color-warning-content": "oklch(19.106% 0.026 112.757)", "--color-error": "oklch(68.22% 0.206 24.43)", "--color-error-content": "oklch(13.644% 0.041 24.43)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "corporate": { "color-scheme": "light", "--color-base-100": "oklch(100% 0 0)", "--color-base-200": "oklch(93% 0 0)", "--color-base-300": "oklch(86% 0 0)", "--color-base-content": "oklch(22.389% 0.031 278.072)", "--color-primary": "oklch(58% 0.158 241.966)", "--color-primary-content": "oklch(100% 0 0)", "--color-secondary": "oklch(55% 0.046 257.417)", "--color-secondary-content": "oklch(100% 0 0)", "--color-accent": "oklch(60% 0.118 184.704)", "--color-accent-content": "oklch(100% 0 0)", "--color-neutral": "oklch(0% 0 0)", "--color-neutral-content": "oklch(100% 0 0)", "--color-info": "oklch(60% 0.126 221.723)", "--color-info-content": "oklch(100% 0 0)", "--color-success": "oklch(62% 0.194 149.214)", "--color-success-content": "oklch(100% 0 0)", "--color-warning": "oklch(85% 0.199 91.936)", "--color-warning-content": "oklch(0% 0 0)", "--color-error": "oklch(70% 0.191 22.216)", "--color-error-content": "oklch(0% 0 0)", "--radius-selector": "0.25rem", "--radius-field": "0.25rem", "--radius-box": "0.25rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "lofi": { "color-scheme": "light", "--color-base-100": "oklch(100% 0 0)", "--color-base-200": "oklch(97% 0 0)", "--color-base-300": "oklch(94% 0 0)", "--color-base-content": "oklch(0% 0 0)", "--color-primary": "oklch(15.906% 0 0)", "--color-primary-content": "oklch(100% 0 0)", "--color-secondary": "oklch(21.455% 0.001 17.278)", "--color-secondary-content": "oklch(100% 0 0)", "--color-accent": "oklch(26.861% 0 0)", "--color-accent-content": "oklch(100% 0 0)", "--color-neutral": "oklch(0% 0 0)", "--color-neutral-content": "oklch(100% 0 0)", "--color-info": "oklch(79.54% 0.103 205.9)", "--color-info-content": "oklch(15.908% 0.02 205.9)", "--color-success": "oklch(90.13% 0.153 164.14)", "--color-success-content": "oklch(18.026% 0.03 164.14)", "--color-warning": "oklch(88.37% 0.135 79.94)", "--color-warning-content": "oklch(17.674% 0.027 79.94)", "--color-error": "oklch(78.66% 0.15 28.47)", "--color-error-content": "oklch(15.732% 0.03 28.47)", "--radius-selector": "2rem", "--radius-field": "0.25rem", "--radius-box": "0.5rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "autumn": { "color-scheme": "light", "--color-base-100": "oklch(95.814% 0 0)", "--color-base-200": "oklch(89.107% 0 0)", "--color-base-300": "oklch(82.4% 0 0)", "--color-base-content": "oklch(19.162% 0 0)", "--color-primary": "oklch(40.723% 0.161 17.53)", "--color-primary-content": "oklch(88.144% 0.032 17.53)", "--color-secondary": "oklch(61.676% 0.169 23.865)", "--color-secondary-content": "oklch(12.335% 0.033 23.865)", "--color-accent": "oklch(73.425% 0.094 60.729)", "--color-accent-content": "oklch(14.685% 0.018 60.729)", "--color-neutral": "oklch(54.367% 0.037 51.902)", "--color-neutral-content": "oklch(90.873% 0.007 51.902)", "--color-info": "oklch(69.224% 0.097 207.284)", "--color-info-content": "oklch(13.844% 0.019 207.284)", "--color-success": "oklch(60.995% 0.08 174.616)", "--color-success-content": "oklch(12.199% 0.016 174.616)", "--color-warning": "oklch(70.081% 0.164 56.844)", "--color-warning-content": "oklch(14.016% 0.032 56.844)", "--color-error": "oklch(53.07% 0.241 24.16)", "--color-error-content": "oklch(90.614% 0.048 24.16)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "1", "--noise": "0" }, "dark": { "color-scheme": "dark", "--color-base-100": "oklch(25.33% 0.016 252.42)", "--color-base-200": "oklch(23.26% 0.014 253.1)", "--color-base-300": "oklch(21.15% 0.012 254.09)", "--color-base-content": "oklch(97.807% 0.029 256.847)", "--color-primary": "oklch(58% 0.233 277.117)", "--color-primary-content": "oklch(96% 0.018 272.314)", "--color-secondary": "oklch(65% 0.241 354.308)", "--color-secondary-content": "oklch(94% 0.028 342.258)", "--color-accent": "oklch(77% 0.152 181.912)", "--color-accent-content": "oklch(38% 0.063 188.416)", "--color-neutral": "oklch(14% 0.005 285.823)", "--color-neutral-content": "oklch(92% 0.004 286.32)", "--color-info": "oklch(74% 0.16 232.661)", "--color-info-content": "oklch(29% 0.066 243.157)", "--color-success": "oklch(76% 0.177 163.223)", "--color-success-content": "oklch(37% 0.077 168.94)", "--color-warning": "oklch(82% 0.189 84.429)", "--color-warning-content": "oklch(41% 0.112 45.904)", "--color-error": "oklch(71% 0.194 13.428)", "--color-error-content": "oklch(27% 0.105 12.094)", "--radius-selector": "0.5rem", "--radius-field": "0.25rem", "--radius-box": "0.5rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "1", "--noise": "0" }, "abyss": { "color-scheme": "dark", "--color-base-100": "oklch(20% 0.08 209)", "--color-base-200": "oklch(15% 0.08 209)", "--color-base-300": "oklch(10% 0.08 209)", "--color-base-content": "oklch(90% 0.076 70.697)", "--color-primary": "oklch(92% 0.2653 125)", "--color-primary-content": "oklch(50% 0.2653 125)", "--color-secondary": "oklch(83.27% 0.0764 298.3)", "--color-secondary-content": "oklch(43.27% 0.0764 298.3)", "--color-accent": "oklch(43% 0 0)", "--color-accent-content": "oklch(98% 0 0)", "--color-neutral": "oklch(30% 0.08 209)", "--color-neutral-content": "oklch(90% 0.076 70.697)", "--color-info": "oklch(74% 0.16 232.661)", "--color-info-content": "oklch(29% 0.066 243.157)", "--color-success": "oklch(79% 0.209 151.711)", "--color-success-content": "oklch(26% 0.065 152.934)", "--color-warning": "oklch(84.8% 0.1962 84.62)", "--color-warning-content": "oklch(44.8% 0.1962 84.62)", "--color-error": "oklch(65% 0.1985 24.22)", "--color-error-content": "oklch(27% 0.1985 24.22)", "--radius-selector": "2rem", "--radius-field": "0.25rem", "--radius-box": "0.5rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "1", "--noise": "0" }, "valentine": { "color-scheme": "light", "--color-base-100": "oklch(97% 0.014 343.198)", "--color-base-200": "oklch(94% 0.028 342.258)", "--color-base-300": "oklch(89% 0.061 343.231)", "--color-base-content": "oklch(52% 0.223 3.958)", "--color-primary": "oklch(65% 0.241 354.308)", "--color-primary-content": "oklch(100% 0 0)", "--color-secondary": "oklch(62% 0.265 303.9)", "--color-secondary-content": "oklch(97% 0.014 308.299)", "--color-accent": "oklch(82% 0.111 230.318)", "--color-accent-content": "oklch(39% 0.09 240.876)", "--color-neutral": "oklch(40% 0.153 2.432)", "--color-neutral-content": "oklch(89% 0.061 343.231)", "--color-info": "oklch(86% 0.127 207.078)", "--color-info-content": "oklch(44% 0.11 240.79)", "--color-success": "oklch(84% 0.143 164.978)", "--color-success-content": "oklch(43% 0.095 166.913)", "--color-warning": "oklch(75% 0.183 55.934)", "--color-warning-content": "oklch(26% 0.079 36.259)", "--color-error": "oklch(63% 0.237 25.331)", "--color-error-content": "oklch(97% 0.013 17.38)", "--radius-selector": "1rem", "--radius-field": "2rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "halloween": { "color-scheme": "dark", "--color-base-100": "oklch(21% 0.006 56.043)", "--color-base-200": "oklch(14% 0.004 49.25)", "--color-base-300": "oklch(0% 0 0)", "--color-base-content": "oklch(84.955% 0 0)", "--color-primary": "oklch(77.48% 0.204 60.62)", "--color-primary-content": "oklch(19.693% 0.004 196.779)", "--color-secondary": "oklch(45.98% 0.248 305.03)", "--color-secondary-content": "oklch(89.196% 0.049 305.03)", "--color-accent": "oklch(64.8% 0.223 136.073)", "--color-accent-content": "oklch(0% 0 0)", "--color-neutral": "oklch(24.371% 0.046 65.681)", "--color-neutral-content": "oklch(84.874% 0.009 65.681)", "--color-info": "oklch(54.615% 0.215 262.88)", "--color-info-content": "oklch(90.923% 0.043 262.88)", "--color-success": "oklch(62.705% 0.169 149.213)", "--color-success-content": "oklch(12.541% 0.033 149.213)", "--color-warning": "oklch(66.584% 0.157 58.318)", "--color-warning-content": "oklch(13.316% 0.031 58.318)", "--color-error": "oklch(65.72% 0.199 27.33)", "--color-error-content": "oklch(13.144% 0.039 27.33)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "1", "--noise": "0" }, "business": { "color-scheme": "dark", "--color-base-100": "oklch(24.353% 0 0)", "--color-base-200": "oklch(22.648% 0 0)", "--color-base-300": "oklch(20.944% 0 0)", "--color-base-content": "oklch(84.87% 0 0)", "--color-primary": "oklch(41.703% 0.099 251.473)", "--color-primary-content": "oklch(88.34% 0.019 251.473)", "--color-secondary": "oklch(64.092% 0.027 229.389)", "--color-secondary-content": "oklch(12.818% 0.005 229.389)", "--color-accent": "oklch(67.271% 0.167 35.791)", "--color-accent-content": "oklch(13.454% 0.033 35.791)", "--color-neutral": "oklch(27.441% 0.013 253.041)", "--color-neutral-content": "oklch(85.488% 0.002 253.041)", "--color-info": "oklch(62.616% 0.143 240.033)", "--color-info-content": "oklch(12.523% 0.028 240.033)", "--color-success": "oklch(70.226% 0.094 156.596)", "--color-success-content": "oklch(14.045% 0.018 156.596)", "--color-warning": "oklch(77.482% 0.115 81.519)", "--color-warning-content": "oklch(15.496% 0.023 81.519)", "--color-error": "oklch(51.61% 0.146 29.674)", "--color-error-content": "oklch(90.322% 0.029 29.674)", "--radius-selector": "0rem", "--radius-field": "0.25rem", "--radius-box": "0.25rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "silk": { "color-scheme": "light", "--color-base-100": "oklch(97% 0.0035 67.78)", "--color-base-200": "oklch(95% 0.0081 61.42)", "--color-base-300": "oklch(90% 0.0081 61.42)", "--color-base-content": "oklch(40% 0.0081 61.42)", "--color-primary": "oklch(23.27% 0.0249 284.3)", "--color-primary-content": "oklch(94.22% 0.2505 117.44)", "--color-secondary": "oklch(23.27% 0.0249 284.3)", "--color-secondary-content": "oklch(73.92% 0.2135 50.94)", "--color-accent": "oklch(23.27% 0.0249 284.3)", "--color-accent-content": "oklch(88.92% 0.2061 189.9)", "--color-neutral": "oklch(20% 0 0)", "--color-neutral-content": "oklch(80% 0.0081 61.42)", "--color-info": "oklch(80.39% 0.1148 241.68)", "--color-info-content": "oklch(30.39% 0.1148 241.68)", "--color-success": "oklch(83.92% 0.0901 136.87)", "--color-success-content": "oklch(23.92% 0.0901 136.87)", "--color-warning": "oklch(83.92% 0.1085 80)", "--color-warning-content": "oklch(43.92% 0.1085 80)", "--color-error": "oklch(75.1% 0.1814 22.37)", "--color-error-content": "oklch(35.1% 0.1814 22.37)", "--radius-selector": "2rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "2px", "--depth": "1", "--noise": "0" }, "forest": { "color-scheme": "dark", "--color-base-100": "oklch(20.84% 0.008 17.911)", "--color-base-200": "oklch(18.522% 0.007 17.911)", "--color-base-300": "oklch(16.203% 0.007 17.911)", "--color-base-content": "oklch(83.768% 0.001 17.911)", "--color-primary": "oklch(68.628% 0.185 148.958)", "--color-primary-content": "oklch(0% 0 0)", "--color-secondary": "oklch(69.776% 0.135 168.327)", "--color-secondary-content": "oklch(13.955% 0.027 168.327)", "--color-accent": "oklch(70.628% 0.119 185.713)", "--color-accent-content": "oklch(14.125% 0.023 185.713)", "--color-neutral": "oklch(30.698% 0.039 171.364)", "--color-neutral-content": "oklch(86.139% 0.007 171.364)", "--color-info": "oklch(72.06% 0.191 231.6)", "--color-info-content": "oklch(0% 0 0)", "--color-success": "oklch(64.8% 0.15 160)", "--color-success-content": "oklch(0% 0 0)", "--color-warning": "oklch(84.71% 0.199 83.87)", "--color-warning-content": "oklch(0% 0 0)", "--color-error": "oklch(71.76% 0.221 22.18)", "--color-error-content": "oklch(0% 0 0)", "--radius-selector": "1rem", "--radius-field": "2rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "black": { "color-scheme": "dark", "--color-base-100": "oklch(0% 0 0)", "--color-base-200": "oklch(19% 0 0)", "--color-base-300": "oklch(22% 0 0)", "--color-base-content": "oklch(87.609% 0 0)", "--color-primary": "oklch(35% 0 0)", "--color-primary-content": "oklch(100% 0 0)", "--color-secondary": "oklch(35% 0 0)", "--color-secondary-content": "oklch(100% 0 0)", "--color-accent": "oklch(35% 0 0)", "--color-accent-content": "oklch(100% 0 0)", "--color-neutral": "oklch(35% 0 0)", "--color-neutral-content": "oklch(100% 0 0)", "--color-info": "oklch(45.201% 0.313 264.052)", "--color-info-content": "oklch(89.04% 0.062 264.052)", "--color-success": "oklch(51.975% 0.176 142.495)", "--color-success-content": "oklch(90.395% 0.035 142.495)", "--color-warning": "oklch(96.798% 0.211 109.769)", "--color-warning-content": "oklch(19.359% 0.042 109.769)", "--color-error": "oklch(62.795% 0.257 29.233)", "--color-error-content": "oklch(12.559% 0.051 29.233)", "--radius-selector": "0rem", "--radius-field": "0rem", "--radius-box": "0rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "cyberpunk": { "color-scheme": "light", "--color-base-100": "oklch(94.51% 0.179 104.32)", "--color-base-200": "oklch(91.51% 0.179 104.32)", "--color-base-300": "oklch(85.51% 0.179 104.32)", "--color-base-content": "oklch(0% 0 0)", "--color-primary": "oklch(74.22% 0.209 6.35)", "--color-primary-content": "oklch(14.844% 0.041 6.35)", "--color-secondary": "oklch(83.33% 0.184 204.72)", "--color-secondary-content": "oklch(16.666% 0.036 204.72)", "--color-accent": "oklch(71.86% 0.217 310.43)", "--color-accent-content": "oklch(14.372% 0.043 310.43)", "--color-neutral": "oklch(23.04% 0.065 269.31)", "--color-neutral-content": "oklch(94.51% 0.179 104.32)", "--color-info": "oklch(72.06% 0.191 231.6)", "--color-info-content": "oklch(0% 0 0)", "--color-success": "oklch(64.8% 0.15 160)", "--color-success-content": "oklch(0% 0 0)", "--color-warning": "oklch(84.71% 0.199 83.87)", "--color-warning-content": "oklch(0% 0 0)", "--color-error": "oklch(71.76% 0.221 22.18)", "--color-error-content": "oklch(0% 0 0)", "--radius-selector": "0rem", "--radius-field": "0rem", "--radius-box": "0rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "emerald": { "color-scheme": "light", "--color-base-100": "oklch(100% 0 0)", "--color-base-200": "oklch(93% 0 0)", "--color-base-300": "oklch(86% 0 0)", "--color-base-content": "oklch(35.519% 0.032 262.988)", "--color-primary": "oklch(76.662% 0.135 153.45)", "--color-primary-content": "oklch(33.387% 0.04 162.24)", "--color-secondary": "oklch(61.302% 0.202 261.294)", "--color-secondary-content": "oklch(100% 0 0)", "--color-accent": "oklch(72.772% 0.149 33.2)", "--color-accent-content": "oklch(0% 0 0)", "--color-neutral": "oklch(35.519% 0.032 262.988)", "--color-neutral-content": "oklch(98.462% 0.001 247.838)", "--color-info": "oklch(72.06% 0.191 231.6)", "--color-info-content": "oklch(0% 0 0)", "--color-success": "oklch(64.8% 0.15 160)", "--color-success-content": "oklch(0% 0 0)", "--color-warning": "oklch(84.71% 0.199 83.87)", "--color-warning-content": "oklch(0% 0 0)", "--color-error": "oklch(71.76% 0.221 22.18)", "--color-error-content": "oklch(0% 0 0)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "lemonade": { "color-scheme": "light", "--color-base-100": "oklch(98.71% 0.02 123.72)", "--color-base-200": "oklch(91.8% 0.018 123.72)", "--color-base-300": "oklch(84.89% 0.017 123.72)", "--color-base-content": "oklch(19.742% 0.004 123.72)", "--color-primary": "oklch(58.92% 0.199 134.6)", "--color-primary-content": "oklch(11.784% 0.039 134.6)", "--color-secondary": "oklch(77.75% 0.196 111.09)", "--color-secondary-content": "oklch(15.55% 0.039 111.09)", "--color-accent": "oklch(85.39% 0.201 100.73)", "--color-accent-content": "oklch(17.078% 0.04 100.73)", "--color-neutral": "oklch(30.98% 0.075 108.6)", "--color-neutral-content": "oklch(86.196% 0.015 108.6)", "--color-info": "oklch(86.19% 0.047 224.14)", "--color-info-content": "oklch(17.238% 0.009 224.14)", "--color-success": "oklch(86.19% 0.047 157.85)", "--color-success-content": "oklch(17.238% 0.009 157.85)", "--color-warning": "oklch(86.19% 0.047 102.15)", "--color-warning-content": "oklch(17.238% 0.009 102.15)", "--color-error": "oklch(86.19% 0.047 25.85)", "--color-error-content": "oklch(17.238% 0.009 25.85)", "--radius-selector": "1rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "1px", "--depth": "0", "--noise": "0" }, "caramellatte": { "color-scheme": "light", "--color-base-100": "oklch(98% 0.016 73.684)", "--color-base-200": "oklch(95% 0.038 75.164)", "--color-base-300": "oklch(90% 0.076 70.697)", "--color-base-content": "oklch(40% 0.123 38.172)", "--color-primary": "oklch(0% 0 0)", "--color-primary-content": "oklch(100% 0 0)", "--color-secondary": "oklch(22.45% 0.075 37.85)", "--color-secondary-content": "oklch(90% 0.076 70.697)", "--color-accent": "oklch(46.44% 0.111 37.85)", "--color-accent-content": "oklch(90% 0.076 70.697)", "--color-neutral": "oklch(55% 0.195 38.402)", "--color-neutral-content": "oklch(98% 0.016 73.684)", "--color-info": "oklch(42% 0.199 265.638)", "--color-info-content": "oklch(90% 0.076 70.697)", "--color-success": "oklch(43% 0.095 166.913)", "--color-success-content": "oklch(90% 0.076 70.697)", "--color-warning": "oklch(82% 0.189 84.429)", "--color-warning-content": "oklch(41% 0.112 45.904)", "--color-error": "oklch(70% 0.191 22.216)", "--color-error-content": "oklch(39% 0.141 25.723)", "--radius-selector": "2rem", "--radius-field": "0.5rem", "--radius-box": "1rem", "--size-selector": "0.25rem", "--size-field": "0.25rem", "--border": "2px", "--depth": "1", "--noise": "1" } };

  // vendor/package/base/rootscrollgutter/object.js
  var object_default2 = { ":root": { "--page-has-backdrop": "var(--page-scroll-lock) 1", "--page-scroll-bg": "var(--page-scroll-lock)\n    color-mix(in srgb, var(--root-bg, #0000), oklch(0% 0 0) calc(var(--page-has-backdrop, 0) * 40%))", "background-image": "var(--page-scroll-lock) linear-gradient(var(--root-bg, #0000), var(--root-bg, #0000))", "transition": "var(--page-scroll-lock) background-color 0.3s ease-out", "animation": "var(--page-scroll-lock) set-page-has-scroll forwards", "animation-timeline": "var(--page-scroll-lock) scroll()", "--page-has-scroll": "initial", "scrollbar-gutter": "var(--page-has-scroll) var(--page-scroll-lock) stable" }, "@keyframes set-page-has-scroll": { "0%, to": { "--page-has-scroll": " " } } };

  // vendor/package/functions/addPrefix.js
  var defaultExcludedPrefixes = ["color-", "size-", "radius-", "border", "depth", "noise"];
  var excludedSelectors = [
    "prose",
    "is-hidden",
    "is-bound",
    "is-disabled",
    "is-today",
    "is-selected",
    "has-event",
    "is-inrange",
    "is-startrange",
    "is-endrange",
    "is-outside-current-month",
    "is-selection-disabled",
    "pick-whole-week"
  ];
  var shouldExcludeSelector = (selector2) => {
    const selectorName = selector2.match(/^[\w-]+/)?.[0] || selector2;
    return excludedSelectors.includes(selectorName) || /^(rdp|pika|vc)-/.test(selectorName);
  };
  var shouldExcludeVariable = (variableName, excludedPrefixes) => {
    if (variableName.startsWith("tw")) {
      return true;
    }
    return excludedPrefixes.some((excludedPrefix) => variableName.startsWith(excludedPrefix));
  };
  var prefixVariable = (variableName, prefix, excludedPrefixes) => {
    if (shouldExcludeVariable(variableName, excludedPrefixes)) {
      return variableName;
    }
    return `${prefix}${variableName}`;
  };
  var isHexDigit = (character) => character !== void 0 && /^[0-9a-fA-F]$/.test(character);
  var isIdentifierCharacter = (character) => {
    if (character === void 0) return false;
    const characterCode = character.charCodeAt(0);
    return character === "-" || character === "_" || character === "\\" || characterCode >= 48 && characterCode <= 57 || characterCode >= 65 && characterCode <= 90 || characterCode >= 97 && characterCode <= 122 || characterCode >= 128;
  };
  var getEscapeEnd = (selector2, start) => {
    if (!isHexDigit(selector2[start + 1])) return Math.min(start + 2, selector2.length);
    let end = start + 1;
    while (end < selector2.length && end < start + 7 && isHexDigit(selector2[end])) {
      end++;
    }
    if (/\s/.test(selector2[end])) end++;
    return end;
  };
  var getIdentifierEnd = (selector2, start) => {
    let end = start;
    while (end < selector2.length && isIdentifierCharacter(selector2[end])) {
      if (selector2[end] === "\\") {
        end = getEscapeEnd(selector2, end);
      } else {
        end++;
      }
    }
    return end;
  };
  var prefixSelectorClasses = (selector2, prefix) => {
    let result = "";
    let attributeDepth = 0;
    let quote = "";
    for (let index = 0; index < selector2.length; ) {
      const character = selector2[index];
      if (quote) {
        if (character === "\\") {
          const escapeEnd = getEscapeEnd(selector2, index);
          result += selector2.slice(index, escapeEnd);
          index = escapeEnd;
          continue;
        }
        result += character;
        index++;
        if (character === quote) quote = "";
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        result += character;
        index++;
        continue;
      }
      if (character === "/" && selector2[index + 1] === "*") {
        const commentEnd = selector2.indexOf("*/", index + 2);
        const end = commentEnd === -1 ? selector2.length : commentEnd + 2;
        result += selector2.slice(index, end);
        index = end;
        continue;
      }
      if (character === "\\") {
        const escapeEnd = getEscapeEnd(selector2, index);
        result += selector2.slice(index, escapeEnd);
        index = escapeEnd;
        continue;
      }
      if (character === "[") {
        attributeDepth++;
      } else if (character === "]" && attributeDepth > 0) {
        attributeDepth--;
      }
      if (character === "." && attributeDepth === 0 && isIdentifierCharacter(selector2[index + 1])) {
        const identifierEnd = getIdentifierEnd(selector2, index + 1);
        const identifier = selector2.slice(index + 1, identifierEnd);
        result += shouldExcludeSelector(identifier) ? `.${identifier}` : `.${prefix}${identifier}`;
        index = identifierEnd;
        continue;
      }
      result += character;
      index++;
    }
    return result;
  };
  var getPrefixedKey = (key, prefix, excludedPrefixes) => {
    if (!prefix) return key;
    if (key.startsWith("--")) {
      const variableName = key.slice(2);
      return `--${prefixVariable(variableName, prefix, excludedPrefixes)}`;
    }
    if (key.startsWith("@property --")) {
      return processStringValue(key, prefix, excludedPrefixes);
    }
    if (key.startsWith("@")) {
      return key;
    }
    const prefixedKey = prefixSelectorClasses(key, prefix);
    return /^[>+~]/.test(prefixedKey) && !prefixedKey.includes(",") ? ` ${prefixedKey}` : prefixedKey;
  };
  var processArrayValue = (value2, prefix, excludedPrefixes) => {
    return value2.map((item) => {
      if (typeof item === "string") {
        if (item.startsWith(".")) {
          return getPrefixedKey(item, prefix, excludedPrefixes);
        }
        return processStringValue(item, prefix, excludedPrefixes);
      }
      if (typeof item === "object" && item !== null) {
        return Array.isArray(item) ? processArrayValue(item, prefix, excludedPrefixes) : addPrefix(item, prefix, excludedPrefixes);
      }
      return item;
    });
  };
  var reVariableName = /--([a-zA-Z0-9_-]+)/g;
  var processStringValue = (value2, prefix, excludedPrefixes) => {
    if (prefix === 0) return value2;
    return value2.replace(reVariableName, (match, variableName) => {
      if (shouldExcludeVariable(variableName, excludedPrefixes)) {
        return match;
      }
      return `--${prefix}${variableName}`;
    });
  };
  var processValue = (value2, prefix, excludedPrefixes) => {
    if (Array.isArray(value2)) {
      return processArrayValue(value2, prefix, excludedPrefixes);
    } else if (typeof value2 === "object" && value2 !== null) {
      return addPrefix(value2, prefix, excludedPrefixes);
    } else if (typeof value2 === "string") {
      return processStringValue(value2, prefix, excludedPrefixes);
    } else {
      return value2;
    }
  };
  var addPrefix = (obj, prefix, excludedPrefixes = defaultExcludedPrefixes) => {
    return Object.entries(obj).reduce((result, [key, value2]) => {
      const newKey = getPrefixedKey(key, prefix, excludedPrefixes);
      result[newKey] = processValue(value2, prefix, excludedPrefixes);
      return result;
    }, {});
  };

  // vendor/package/base/rootscrollgutter/index.js
  var rootscrollgutter_default = ({ addBase, prefix = "" }) => {
    const prefixedrootscrollgutter = addPrefix(object_default2, prefix);
    addBase({ ...prefixedrootscrollgutter });
  };

  // vendor/package/base/svg/object.js
  var object_default3 = { ":root": { "--fx-noise": `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='a'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.34' numOctaves='4' stitchTiles='stitch'%3E%3C/feTurbulence%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23a)' opacity='0.2'%3E%3C/rect%3E%3C/svg%3E")` } };

  // vendor/package/base/svg/index.js
  var svg_default = ({ addBase, prefix = "" }) => {
    const prefixedsvg = addPrefix(object_default3, prefix);
    addBase({ ...prefixedsvg });
  };

  // vendor/package/base/scrollbar/object.js
  var object_default4 = { ":root": { "scrollbar-color": "color-mix(in oklch, currentColor 35%, #0000) #0000" } };

  // vendor/package/base/scrollbar/index.js
  var scrollbar_default = ({ addBase, prefix = "" }) => {
    const prefixedscrollbar = addPrefix(object_default4, prefix);
    addBase({ ...prefixedscrollbar });
  };

  // vendor/package/base/properties/object.js
  var object_default5 = { "@property --radialprogress": { "syntax": '"<percentage>"', "inherits": "true", "initial-value": "0%" }, "@property --aura-angle": { "syntax": '"<angle>"', "inherits": "false", "initial-value": "0deg" } };

  // vendor/package/base/properties/index.js
  var properties_default = ({ addBase, prefix = "" }) => {
    const prefixedproperties = addPrefix(object_default5, prefix);
    addBase({ ...prefixedproperties });
  };

  // vendor/package/base/rootcolor/object.js
  var object_default6 = { ":root, [data-theme]": { "background-color": "var(--root-bg)", "color": "var(--color-base-content)" }, ":root": { "background-color": "var(--page-scroll-bg, var(--root-bg))" }, ":where(:root, [data-theme])": { "--root-bg": "var(--color-base-100)" } };

  // vendor/package/base/rootcolor/index.js
  var rootcolor_default = ({ addBase, prefix = "" }) => {
    const prefixedrootcolor = addPrefix(object_default6, prefix);
    addBase({ ...prefixedrootcolor });
  };

  // vendor/package/base/rootscrolllock/object.js
  var object_default7 = { ":root": { "--page-scroll-lock": "initial", "--page-overflow": "var(--page-scroll-lock) hidden" }, ":root:not(span)": { "overflow": "var(--page-overflow)" } };

  // vendor/package/base/rootscrolllock/index.js
  var rootscrolllock_default = ({ addBase, prefix = "" }) => {
    const prefixedrootscrolllock = addPrefix(object_default7, prefix);
    addBase({ ...prefixedrootscrolllock });
  };

  // vendor/package/components/skeleton/object.js
  var object_default8 = { "@layer daisyui.l1.l2.l3": { ".skeleton": { "border-radius": "var(--radius-box)", "background-color": "var(--color-base-300)", "will-change": "background-position", "background-image": "linear-gradient( 105deg, #0000 0% 40%, var(--color-base-100) 50%, #0000 60% 100% )", "background-size": "200% auto", "background-position-x": "-50%" }, "@media (prefers-reduced-motion: reduce)": { ".skeleton": { "transition-duration": "15s" } }, "@media (prefers-reduced-motion: no-preference)": { ".skeleton": { "animation": "skeleton 1.8s ease-in-out infinite" }, ".skeleton:dir(rtl)": { "animation-direction": "reverse" } } }, "@layer daisyui.l1.l2": { ".skeleton-text": { "background-clip": "text", "webkit-background-clip": "text", "color": "transparent", "background-image": "linear-gradient( 105deg, color-mix(in oklab, var(--color-base-content) 20%, transparent) 0% 40%, var(--color-base-content) 50%, color-mix(in oklab, var(--color-base-content) 20%, transparent) 60% 100% )" } }, "@keyframes skeleton": { "0%": { "background-position": "150%" }, "100%": { "background-position": "-50%" } } };

  // vendor/package/components/skeleton/index.js
  var skeleton_default = ({ addComponents, prefix = "" }) => {
    const prefixedskeleton = addPrefix(object_default8, prefix);
    addComponents({ ...prefixedskeleton });
  };

  // vendor/package/components/mask/object.js
  var object_default9 = { "@layer daisyui.l1.l2.l3": { ".mask": { "display": "inline-block", "vertical-align": "middle", "mask-size": "contain", "mask-repeat": "no-repeat", "mask-position": "center" } }, "@layer daisyui.l1.l2": { ".mask-half-1": { "mask-size": "200%", "mask-position": "left" }, '.mask-half-1:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)': { "mask-position": "right" }, ".mask-half-2": { "mask-size": "200%", "mask-position": "right" }, '.mask-half-2:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)': { "mask-position": "left" }, ".mask-squircle": { "mask-image": `url("data:image/svg+xml,%3csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M100 0C20 0 0 20 0 100s20 100 100 100 100-20 100-100S180 0 100 0Z'/%3e%3c/svg%3e")` }, ".mask-decagon": { "mask-image": `url("data:image/svg+xml,%3csvg width='192' height='200' xmlns='http://www.w3.org/2000/svg'%3e%3cpath fill='black' d='m96 0 58.779 19.098 36.327 50v61.804l-36.327 50L96 200l-58.779-19.098-36.327-50V69.098l36.327-50z' fill-rule='evenodd'/%3e%3c/svg%3e")` }, ".mask-diamond": { "mask-image": `url("data:image/svg+xml,%3csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3e%3cpath fill='black' d='m100 0 100 100-100 100L0 100z' fill-rule='evenodd'/%3e%3c/svg%3e")` }, ".mask-heart": { "mask-image": `url("data:image/svg+xml,%3csvg width='200' height='185' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M100 184.606a15.384 15.384 0 0 1-8.653-2.678C53.565 156.28 37.205 138.695 28.182 127.7 8.952 104.264-.254 80.202.005 54.146.308 24.287 24.264 0 53.406 0c21.192 0 35.869 11.937 44.416 21.879a2.884 2.884 0 0 0 4.356 0C110.725 11.927 125.402 0 146.594 0c29.142 0 53.098 24.287 53.4 54.151.26 26.061-8.956 50.122-28.176 73.554-9.023 10.994-25.383 28.58-63.165 54.228a15.384 15.384 0 0 1-8.653 2.673Z' fill='black' fill-rule='nonzero'/%3e%3c/svg%3e")` }, ".mask-hexagon": { "mask-image": `url("data:image/svg+xml,%3csvg width='182' height='201' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M.3 65.486c0-9.196 6.687-20.063 14.211-25.078l61.86-35.946c8.36-5.016 20.899-5.016 29.258 0l61.86 35.946c8.36 5.015 14.211 15.882 14.211 25.078v71.055c0 9.196-6.687 20.063-14.211 25.079l-61.86 35.945c-8.36 4.18-20.899 4.18-29.258 0L14.51 161.62C6.151 157.44.3 145.737.3 136.54V65.486Z' fill='black' fill-rule='nonzero'/%3e%3c/svg%3e")` }, ".mask-hexagon-2": { "mask-image": `url("data:image/svg+xml,%3csvg width='200' height='182' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M64.786 181.4c-9.196 0-20.063-6.687-25.079-14.21L3.762 105.33c-5.016-8.36-5.016-20.9 0-29.259l35.945-61.86C44.723 5.851 55.59 0 64.786 0h71.055c9.196 0 20.063 6.688 25.079 14.211l35.945 61.86c4.18 8.36 4.18 20.899 0 29.258l-35.945 61.86c-4.18 8.36-15.883 14.211-25.079 14.211H64.786Z' fill='black' fill-rule='nonzero'/%3e%3c/svg%3e")` }, ".mask-circle": { "mask-image": `url("data:image/svg+xml,%3csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle fill='black' cx='100' cy='100' r='100' fill-rule='evenodd'/%3e%3c/svg%3e")` }, ".mask-pentagon": { "mask-image": `url("data:image/svg+xml,%3csvg width='192' height='181' xmlns='http://www.w3.org/2000/svg'%3e%3cpath fill='black' d='m96 0 95.106 69.098-36.327 111.804H37.22L.894 69.098z' fill-rule='evenodd'/%3e%3c/svg%3e")` }, ".mask-star": { "mask-image": `url("data:image/svg+xml,%3csvg width='192' height='180' xmlns='http://www.w3.org/2000/svg'%3e%3cpath fill='black' d='m96 137.263-58.779 42.024 22.163-68.389L.894 68.481l72.476-.243L96 0l22.63 68.238 72.476.243-58.49 42.417 22.163 68.389z' fill-rule='evenodd'/%3e%3c/svg%3e")` }, ".mask-star-2": { "mask-image": `url("data:image/svg+xml,%3csvg width='192' height='180' xmlns='http://www.w3.org/2000/svg'%3e%3cpath fill='black' d='m96 153.044-58.779 26.243 7.02-63.513L.894 68.481l63.117-13.01L96 0l31.989 55.472 63.117 13.01-43.347 47.292 7.02 63.513z' fill-rule='evenodd'/%3e%3c/svg%3e")` }, ".mask-triangle": { "mask-image": `url("data:image/svg+xml,%3csvg width='174' height='149' xmlns='http://www.w3.org/2000/svg'%3e%3cpath fill='black' d='m87 148.476-86.603.185L43.86 74.423 87 0l43.14 74.423 43.463 74.238z' fill-rule='evenodd'/%3e%3c/svg%3e")` }, ".mask-triangle-2": { "mask-image": `url("data:image/svg+xml,%3csvg width='174' height='150' xmlns='http://www.w3.org/2000/svg'%3e%3cpath fill='black' d='m87 .738 86.603-.184-43.463 74.238L87 149.214 43.86 74.792.397.554z' fill-rule='evenodd'/%3e%3c/svg%3e")` }, ".mask-triangle-3": { "mask-image": `url("data:image/svg+xml,%3csvg width='150' height='174' xmlns='http://www.w3.org/2000/svg'%3e%3cpath fill='black' d='m149.369 87.107.185 86.603-74.239-43.463L.893 87.107l74.422-43.14L149.554.505z' fill-rule='evenodd'/%3e%3c/svg%3e")` }, ".mask-triangle-4": { "mask-image": `url("data:image/svg+xml,%3csvg width='150' height='174' xmlns='http://www.w3.org/2000/svg'%3e%3cpath fill='black' d='M.631 87.107.446.505l74.239 43.462 74.422 43.14-74.422 43.14L.446 173.71z' fill-rule='evenodd'/%3e%3c/svg%3e")` } } };

  // vendor/package/components/mask/index.js
  var mask_default = ({ addComponents, prefix = "" }) => {
    const prefixedmask = addPrefix(object_default9, prefix);
    addComponents({ ...prefixedmask });
  };

  // vendor/package/components/status/object.js
  var object_default10 = { "@layer daisyui.l1.l2.l3": { ".status": { "display": "inline-block", "aspect-ratio": "1 / 1", "width": "calc(0.25rem * 2)", "height": "calc(0.25rem * 2)", "border-radius": "var(--radius-selector)", "background-color": "color-mix(in oklab, var(--color-base-content) 20%, transparent)", "background-position": "center", "background-repeat": "no-repeat", "vertical-align": "middle", "color": "color-mix(in oklab, var(--color-black) 30%, transparent)", "background-image": "radial-gradient( circle at 35% 30%, oklch(1 0 0 / calc(var(--depth) * 0.5)), #0000 )", "box-shadow": "0 2px 3px -1px color-mix(in oklab, currentColor calc(var(--depth) * 100%), #0000)" } }, "@layer daisyui.l1.l2": { ".status-primary": { "background-color": "var(--color-primary)", "color": "var(--color-primary)" }, ".status-secondary": { "background-color": "var(--color-secondary)", "color": "var(--color-secondary)" }, ".status-accent": { "background-color": "var(--color-accent)", "color": "var(--color-accent)" }, ".status-neutral": { "background-color": "var(--color-neutral)", "color": "var(--color-neutral)" }, ".status-info": { "background-color": "var(--color-info)", "color": "var(--color-info)" }, ".status-success": { "background-color": "var(--color-success)", "color": "var(--color-success)" }, ".status-warning": { "background-color": "var(--color-warning)", "color": "var(--color-warning)" }, ".status-error": { "background-color": "var(--color-error)", "color": "var(--color-error)" }, ".status-xs": { "width": "calc(0.25rem * 0.5)", "height": "calc(0.25rem * 0.5)" }, ".status-sm": { "width": "0.25rem", "height": "0.25rem" }, ".status-md": { "width": "calc(0.25rem * 2)", "height": "calc(0.25rem * 2)" }, ".status-lg": { "width": "calc(0.25rem * 3)", "height": "calc(0.25rem * 3)" }, ".status-xl": { "width": "calc(0.25rem * 4)", "height": "calc(0.25rem * 4)" } } };

  // vendor/package/components/status/index.js
  var status_default = ({ addComponents, prefix = "" }) => {
    const prefixedstatus = addPrefix(object_default10, prefix);
    addComponents({ ...prefixedstatus });
  };

  // vendor/package/components/checkbox/object.js
  var object_default11 = { "@layer daisyui.l1.l2.l3": { ".checkbox": { "border": "var(--border) solid var(--input-color, color-mix(in oklab, var(--color-base-content) 20%, #0000))", "position": "relative", "display": "inline-block", "flex-shrink": 0, "cursor": "pointer", "appearance": "none", "border-radius": "var(--radius-selector)", "padding": "0.25rem", "vertical-align": "middle", "color": "var(--color-base-content)", "box-shadow": "0 1px oklch(0% 0 0 / calc(var(--depth) * 0.1)) inset, 0 0 #0000 inset, 0 0 #0000", "transition": "background-color 0.2s, box-shadow 0.2s", "--size": "calc(var(--size-selector, 0.25rem) * 6)", "width": "var(--size)", "height": "var(--size)", "background-size": "auto, calc(var(--noise) * 100%)", "background-image": "none, var(--fx-noise)" }, ".checkbox:before": { "--tw-content": '""', "content": "var(--tw-content)", "display": "block", "width": "100%", "height": "100%", "rotate": "45deg", "background-color": "currentcolor", "opacity": "0%", "transition": "clip-path 0.3s, opacity 0.1s, rotate 0.3s, translate 0.3s", "transition-delay": "0.1s", "clip-path": "polygon(20% 100%, 20% 80%, 50% 80%, 50% 80%, 70% 80%, 70% 100%)", "box-shadow": "0px 3px 0 0px oklch(100% 0 0 / calc(var(--depth) * 0.1)) inset", "font-size": "1rem", "line-height": 0.75 }, ".checkbox:focus-visible": { "outline": "2px solid var(--input-color, currentColor)", "outline-offset": "2px" }, '.checkbox:checked, .checkbox[aria-checked="true"]': { "background-color": "var(--input-color, #0000)", "box-shadow": "0 0 #0000 inset, 0 8px 0 -4px oklch(100% 0 0 / calc(var(--depth) * 0.1)) inset, 0 1px oklch(0% 0 0 / calc(var(--depth) * 0.1))", "&:before": { "clip-path": "polygon(20% 100%, 20% 80%, 50% 80%, 50% 0%, 70% 0%, 70% 100%)", "translate": "3.5% -7%", "opacity": "100%" }, "@media (forced-colors: active)": { "&:before": { "rotate": "0deg", "background-color": "transparent", "--tw-content": '"\u2714\uFE0E"', "clip-path": "none" } }, "@media print": { "&:before": { "rotate": "0deg", "background-color": "transparent", "--tw-content": '"\u2714\uFE0E"', "clip-path": "none" } } }, '.checkbox:indeterminate, .checkbox[aria-checked="mixed"]': { "background-color": "var( --input-color, color-mix(in oklab, var(--color-base-content) 20%, #0000) )", "&:before": { "rotate": "0deg", "opacity": "100%", "translate": "0 -40%", "clip-path": "polygon(20% 100%, 20% 80%, 50% 80%, 50% 80%, 80% 80%, 80% 100%)" } } }, "@layer daisyui.l1.l2": { ".checkbox-primary": { "color": "var(--color-primary-content)", "--input-color": "var(--color-primary)" }, ".checkbox-secondary": { "color": "var(--color-secondary-content)", "--input-color": "var(--color-secondary)" }, ".checkbox-accent": { "color": "var(--color-accent-content)", "--input-color": "var(--color-accent)" }, ".checkbox-neutral": { "color": "var(--color-neutral-content)", "--input-color": "var(--color-neutral)" }, ".checkbox-info": { "color": "var(--color-info-content)", "--input-color": "var(--color-info)" }, ".checkbox-success": { "color": "var(--color-success-content)", "--input-color": "var(--color-success)" }, ".checkbox-warning": { "color": "var(--color-warning-content)", "--input-color": "var(--color-warning)" }, ".checkbox-error": { "color": "var(--color-error-content)", "--input-color": "var(--color-error)" }, ".checkbox:disabled": { "cursor": "not-allowed", "opacity": "20%" }, ".checkbox-xs": { "padding": "0.125rem", "--size": "calc(var(--size-selector, 0.25rem) * 4)" }, ".checkbox-sm": { "padding": "0.1875rem", "--size": "calc(var(--size-selector, 0.25rem) * 5)" }, ".checkbox-md": { "padding": "0.25rem", "--size": "calc(var(--size-selector, 0.25rem) * 6)" }, ".checkbox-lg": { "padding": "0.3125rem", "--size": "calc(var(--size-selector, 0.25rem) * 7)" }, ".checkbox-xl": { "padding": "0.375rem", "--size": "calc(var(--size-selector, 0.25rem) * 8)" } } };

  // vendor/package/components/checkbox/index.js
  var checkbox_default = ({ addComponents, prefix = "" }) => {
    const prefixedcheckbox = addPrefix(object_default11, prefix);
    addComponents({ ...prefixedcheckbox });
  };

  // vendor/package/components/radio/object.js
  var object_default12 = { "@layer daisyui.l1.l2.l3": { ".radio": { "position": "relative", "display": "inline-block", "flex-shrink": 0, "cursor": "pointer", "appearance": "none", "border-radius": "calc(infinity * 1px)", "padding": "0.25rem", "vertical-align": "middle", "border": "var(--border) solid var(--input-color, color-mix(in srgb, currentColor 20%, #0000))", "box-shadow": "0 1px oklch(0% 0 0 / calc(var(--depth) * 0.1)) inset", "--size": "calc(var(--size-selector, 0.25rem) * 6)", "width": "var(--size)", "height": "var(--size)", "color": "var(--input-color, currentColor)" }, ".radio:before": { "display": "block", "width": "100%", "height": "100%", "border-radius": "calc(infinity * 1px)", "--tw-content": '""', "content": "var(--tw-content)", "background-size": "auto, calc(var(--noise) * 100%)", "background-image": "none, var(--fx-noise)" }, ".radio:focus-visible": { "outline": "2px solid currentColor" }, '.radio:checked, .radio[aria-checked="true"]': { "border-color": "currentcolor", "background-color": "var(--color-base-100)", "@media (prefers-reduced-motion: no-preference)": { "animation": "radio 0.2s ease-out" }, "&:before": { "background-color": "currentcolor", "box-shadow": "0 -1px oklch(0% 0 0 / calc(var(--depth) * 0.1)) inset, 0 8px 0 -4px oklch(100% 0 0 / calc(var(--depth) * 0.1)) inset, 0 1px oklch(0% 0 0 / calc(var(--depth) * 0.1))" }, "@media (forced-colors: active)": { "&:before": { "outline-style": "var(--tw-outline-style)", "outline-width": "1px", "outline-offset": "calc(1px * -1)" } }, "@media print": { "&:before": { "outline": "0.25rem solid", "outline-offset": "-1rem" } } } }, "@layer daisyui.l1.l2": { ".radio-primary": { "--input-color": "var(--color-primary)" }, ".radio-secondary": { "--input-color": "var(--color-secondary)" }, ".radio-accent": { "--input-color": "var(--color-accent)" }, ".radio-neutral": { "--input-color": "var(--color-neutral)" }, ".radio-info": { "--input-color": "var(--color-info)" }, ".radio-success": { "--input-color": "var(--color-success)" }, ".radio-warning": { "--input-color": "var(--color-warning)" }, ".radio-error": { "--input-color": "var(--color-error)" }, ".radio:disabled": { "cursor": "not-allowed", "opacity": "20%" }, ".radio-xs": { "padding": "0.125rem" }, '.radio-xs:is([type="radio"])': { "--size": "calc(var(--size-selector, 0.25rem) * 4)" }, ".radio-sm": { "padding": "0.1875rem" }, '.radio-sm:is([type="radio"])': { "--size": "calc(var(--size-selector, 0.25rem) * 5)" }, ".radio-md": { "padding": "0.25rem" }, '.radio-md:is([type="radio"])': { "--size": "calc(var(--size-selector, 0.25rem) * 6)" }, ".radio-lg": { "padding": "0.3125rem" }, '.radio-lg:is([type="radio"])': { "--size": "calc(var(--size-selector, 0.25rem) * 7)" }, ".radio-xl": { "padding": "0.375rem" }, '.radio-xl:is([type="radio"])': { "--size": "calc(var(--size-selector, 0.25rem) * 8)" } }, "@keyframes radio": { "0%": { "padding": "5px" }, "50%": { "padding": "3px" } } };

  // vendor/package/components/radio/index.js
  var radio_default = ({ addComponents, prefix = "" }) => {
    const prefixedradio = addPrefix(object_default12, prefix);
    addComponents({ ...prefixedradio });
  };

  // vendor/package/components/collapse/object.js
  var object_default13 = { ".collapse:not(td, tr, colgroup)": { "visibility": "revert-layer", "@layer daisyui.l1.l2.l3": { "display": "grid", "position": "relative", "border-radius": "var(--radius-box, 1rem)", "width": "100%", "grid-template-rows": "max-content 0fr", "grid-template-columns": "minmax(0, 1fr)", "isolation": "isolate", "@media (prefers-reduced-motion: no-preference)": { "transition": "grid-template-rows 0.2s" }, '> input:is([type="checkbox"], [type="radio"])': { "grid-column-start": "1", "grid-row-start": "1", "appearance": "none", "opacity": 0, "z-index": 1, "width": "100%", "padding": "1rem", "padding-inline-end": "3rem", "min-height": "1lh", "transition": "background-color 0.2s ease-out" }, '&:is( [open], [tabindex]:focus:not(.collapse-close), [tabindex]:focus-within:not(.collapse-close) ), &:not(.collapse-close):has(> input:is([type="checkbox"], [type="radio"]):checked)': { "grid-template-rows": "max-content 1fr" }, '&:is( [open], [tabindex]:focus:not(.collapse-close), [tabindex]:focus-within:not(.collapse-close) ) > .collapse-content, &:not(.collapse-close) > :where(input:is([type="checkbox"], [type="radio"]):checked ~ .collapse-content)': { "--overflow-delay": "0.2s", "overflow": "revert-layer", "content-visibility": "visible", "min-height": "fit-content", "@supports not (content-visibility: visible)": { "visibility": "visible" } }, '&:focus-visible, &:has(> input:is([type="checkbox"], [type="radio"]):focus-visible), &:has(summary:focus-visible)': { "outline-color": "var(--color-base-content)", "outline-style": "solid", "outline-width": "2px", "outline-offset": "2px" }, "&:not(.collapse-close)": { '> input[type="checkbox"], > input[type="radio"]:not(:checked), > .collapse-title': { "cursor": "pointer" } }, "&[tabindex]:focus:not(.collapse-close, .collapse[open]), &[tabindex]:focus-within:not(.collapse-close, .collapse[open])": { "> .collapse-title": { "cursor": "unset" } }, '&:is( [open], [tabindex]:focus:not(.collapse-close), [tabindex]:focus-within:not(.collapse-close) ) > :where(.collapse-content), &:not(.collapse-close) > :where(input:is([type="checkbox"], [type="radio"]):checked ~ .collapse-content)': { "padding-bottom": "1rem" }, "&:is(details)": { "width": "100%", "&::details-content": { "--overflow-delay": "0s", "overflow": "clip", "height": "0" }, "&:where([open])::details-content": { "overflow": "revert-layer", "height": "auto" }, "@media (prefers-reduced-motion: no-preference)": { "&::details-content": { "transition": "overflow 0.2s allow-discrete var(--overflow-delay), content-visibility 0.2s allow-discrete, visibility 0.2s allow-discrete, min-height 0.2s ease-out allow-discrete, padding 0.1s ease-out 20ms, background-color 0.2s ease-out, height 0.2s", "interpolate-size": "allow-keywords" }, "&:where([open])::details-content": { "--overflow-delay": "0.2s" } }, "> summary": { "position": "relative", "display": "block", "outline": "none", "&::-webkit-details-marker": { "display": "none" } } } }, "@layer daisyui.l1.l2": { "&:is([open])": { "&.collapse-arrow": { "> .collapse-title:after": { "@media (prefers-reduced-motion: no-preference)": { "transform": "translateY(-50%) rotate(225deg)" } } } }, "&.collapse-open": { "&.collapse-arrow": { "> .collapse-title:after": { "@media (prefers-reduced-motion: no-preference)": { "transform": "translateY(-50%) rotate(225deg)" } } }, "&.collapse-plus": { "> .collapse-title:after": { "--tw-content": '"\u2212"', "content": "var(--tw-content)" } } }, "&[tabindex].collapse-arrow:focus:not(.collapse-close), &.collapse-arrow[tabindex]:focus-within:not(.collapse-close)": { "> .collapse-title:after": { "transform": "translateY(-50%) rotate(225deg)" } }, "&.collapse-arrow:not(.collapse-close)": { '> input:is([type="checkbox"], [type="radio"]):checked ~ .collapse-title:after': { "transform": "translateY(-50%) rotate(225deg)" } }, "&[open]": { "&.collapse-plus": { "> .collapse-title:after": { "--tw-content": '"\u2212"', "content": "var(--tw-content)" } } }, "&[tabindex].collapse-plus:focus:not(.collapse-close)": { "> .collapse-title:after": { "--tw-content": '"\u2212"', "content": "var(--tw-content)" } }, "&.collapse-plus:not(.collapse-close)": { '> input:is([type="checkbox"], [type="radio"]):checked ~ .collapse-title:after': { "--tw-content": '"\u2212"', "content": "var(--tw-content)" } } } }, "@layer daisyui.l1.l2.l3": [{ ".collapse-content": { "--overflow-delay": "0s", "content-visibility": "hidden", "overflow": "clip", "grid-column-start": "1", "grid-row-start": "2", "min-height": "0", "padding-left": "1rem", "padding-right": "1rem", "cursor": "unset" }, "@supports not (content-visibility: hidden)": { ".collapse-content": { "visibility": "hidden" } }, "@media (prefers-reduced-motion: no-preference)": { ".collapse-content": { "transition": "overflow 0.2s allow-discrete var(--overflow-delay), content-visibility 0.2s allow-discrete, visibility 0.2s allow-discrete, min-height 0.2s ease-out allow-discrete, padding 0.1s ease-out 20ms, background-color 0.2s ease-out" } }, "details > .collapse-content": { "content-visibility": "visible" } }, { ".collapse-title": { "grid-column-start": "1", "grid-row-start": "1", "position": "relative", "width": "100%", "padding": "1rem", "padding-inline-end": "3rem", "min-height": "1lh", "transition": "background-color 0.2s ease-out" } }], "@layer daisyui.l1.l2": [{ ".collapse-arrow > .collapse-title:after": { "position": "absolute", "display": "block", "height": "0.5rem", "width": "0.5rem", "transform": "translateY(-100%) rotate(45deg)", "@media (prefers-reduced-motion: no-preference)": { "transition-property": "all", "transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)", "transition-duration": "0.2s" }, "top": "50%", "inset-inline-end": "1.4rem", "content": '""', "transform-origin": "75% 75%", "box-shadow": "2px 2px", "pointer-events": "none" }, ".collapse-plus > .collapse-title:after": { "position": "absolute", "display": "block", "height": "0.5rem", "width": "0.5rem", "@media (prefers-reduced-motion: no-preference)": { "transition-property": "all", "transition-duration": "300ms", "transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)" }, "top": "0.9rem", "inset-inline-end": "1.4rem", "--tw-content": '"+"', "content": "var(--tw-content)", "pointer-events": "none" } }, { ".collapse-open": { "grid-template-rows": "max-content 1fr" }, ".collapse-open > .collapse-content": { "--overflow-delay": "0.2s", "overflow": "revert-layer", "content-visibility": "visible", "min-height": "fit-content", "padding-bottom": "1rem", "@supports not (content-visibility: visible)": { "visibility": "visible" } } }] };

  // vendor/package/components/collapse/index.js
  var collapse_default = ({ addComponents, prefix = "" }) => {
    const prefixedcollapse = addPrefix(object_default13, prefix);
    addComponents({ ...prefixedcollapse });
  };

  // vendor/package/components/fieldset/object.js
  var object_default14 = { "@layer daisyui.l1.l2.l3": { ".fieldset": { "display": "grid", "gap": "calc(0.25rem * 1.5)", "padding-block": "0.25rem", "font-size": "0.75rem", "grid-template-columns": "1fr", "grid-auto-rows": "max-content" }, ".fieldset-legend": { "margin-bottom": "calc(0.25rem * -1)", "display": "flex", "align-items": "center", "justify-content": "space-between", "gap": "calc(0.25rem * 2)", "padding-block": "calc(0.25rem * 2)", "color": "var(--color-base-content)", "font-weight": 600, "margin-inline-end": "auto" }, ".fieldset-label": { "display": "flex", "align-items": "center", "gap": "calc(0.25rem * 1.5)", "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)" }, ".fieldset-label:has(input)": { "cursor": "pointer" } } };

  // vendor/package/components/fieldset/index.js
  var fieldset_default = ({ addComponents, prefix = "" }) => {
    const prefixedfieldset = addPrefix(object_default14, prefix);
    addComponents({ ...prefixedfieldset });
  };

  // vendor/package/components/diff/object.js
  var object_default15 = { "@layer daisyui.l1.l2": { ".diff": { "position": "relative", "display": "grid", "width": "100%", "overflow": "hidden", "webkit-user-select": "none", "user-select": "none", "align-items": "normal", "grid-template-rows": "1fr 1.8rem 1fr", "direction": "ltr", "container-type": "inline-size", "grid-template-columns": "auto 1fr" }, ".diff:focus-visible, .diff:has(.diff-item-1:focus-visible)": { "outline-style": "var(--tw-outline-style)", "outline-width": "2px", "outline-offset": "1px", "outline-color": "var(--color-base-content)" }, ".diff:focus-visible": { "outline-style": "var(--tw-outline-style)", "outline-width": "2px", "outline-offset": "1px", "outline-color": "var(--color-base-content)", ".diff-resizer": { "min-width": "95cqi", "max-width": "95cqi" } }, ".diff:has(.diff-item-1:focus-visible)": { "outline-style": "var(--tw-outline-style)", "outline-width": "2px", "outline-offset": "1px", ".diff-resizer": { "min-width": "5cqi", "max-width": "5cqi" } }, ".diff:hover .diff-item-2::after": { "height": "2.4rem" }, "@supports (-webkit-overflow-scrolling: touch) and (overflow: -webkit-paged-x)": { ".diff:focus .diff-resizer": { "min-width": "5cqi", "max-width": "5cqi" }, ".diff:has(.diff-item-1:focus) .diff-resizer": { "min-width": "95cqi", "max-width": "95cqi" } } }, "@layer daisyui.l1.l2.l3": { ".diff-resizer": { "position": "relative", "isolation": "isolate", "z-index": 2, "grid-column-start": "1", "grid-row-start": "2", "height": "calc(0.25rem * 3)", "width": "50cqi", "max-width": "calc(100cqi - 1rem)", "min-width": "1rem", "resize": "horizontal", "overflow": "hidden", "opacity": "0%", "transform": "scaleY(5) translate(0.32rem, 50%)", "cursor": "ew-resize", "transform-origin": "100% 100%", "clip-path": "inset(calc(100% - 0.75rem) 0 0 calc(100% - 0.75rem))", "transition": "min-width 0.3s ease-out, max-width 0.3s ease-out" }, ".diff-item-2": { "position": "relative", "grid-column-start": "1", "grid-row": "span 3 / span 3", "grid-row-start": "1" }, ".diff-item-2:after": { "pointer-events": "none", "position": "absolute", "top": "calc(1 / 2 * 100%)", "right": "1px", "bottom": "0px", "z-index": 2, "border-radius": "calc(infinity * 1px)", "background-color": "color-mix(in oklab, var(--color-base-100) 98%, transparent)", "width": "1.2rem", "height": "1.8rem", "border": "2px solid var(--color-base-100)", "content": '""', "box-shadow": "0 0 0 2px #0000002a", "outline": "2px solid color-mix(in oklab, var(--color-base-content) 10%, #0000)", "outline-offset": "-3px", "translate": "50% -50%", "transition": "height 0.3s linear(0, 0.931 13.8%, 1.196 21.4%, 1.343 29.8%, 1.378 36%, 1.365 43.2%, 1.059 78%, 1)" }, ".diff-item-2 > *": { "pointer-events": "none", "position": "absolute", "top": "0px", "bottom": "0px", "left": "0px", "height": "100%", "width": "100cqi", "max-width": "none", "object-fit": "cover", "object-position": "center" }, "@supports (-webkit-overflow-scrolling: touch) and (overflow: -webkit-paged-x)": { ".diff-item-2:after": { "--tw-content": "none", "content": "var(--tw-content)" } }, ".diff-item-1": { "position": "relative", "z-index": 1, "grid-column-start": "1", "grid-row": "span 3 / span 3", "grid-row-start": "1", "overflow": "hidden", "border-right": "2px solid var(--color-base-100)", "box-shadow": "0 0 0 2px #0000002a" }, ".diff-item-1:focus-visible": { "--tw-outline-style": "none", "outline-style": "none" }, ".diff-item-1 > *": { "pointer-events": "none", "position": "absolute", "top": "0px", "bottom": "0px", "left": "0px", "height": "100%", "width": "100cqi", "max-width": "none", "object-fit": "cover", "object-position": "center" } } };

  // vendor/package/components/diff/index.js
  var diff_default = ({ addComponents, prefix = "" }) => {
    const prefixeddiff = addPrefix(object_default15, prefix);
    addComponents({ ...prefixeddiff });
  };

  // vendor/package/components/hover3d/object.js
  var object_default16 = { "@layer daisyui.l1.l2.l3": { ".hover-3d": { "display": "inline-grid", "perspective": "75rem", "--transform": "0, 0", "--shine": "100% 100%", "--shadow": "0rem 0rem 0rem", "--ease": "linear(0, 0.931 13.8%, 1.196 21.4%, 1.343 29.8%, 1.378 36%, 1.365 43.2%, 1.059 78%, 1)", "filter": "drop-shadow(var(--shadow) 0.1rem #00000003) drop-shadow(var(--shadow) 0.2rem #00000003) drop-shadow(var(--shadow) 0.3rem #00000003) drop-shadow(var(--shadow) 0.4rem #00000003)", "transition": "filter ease-out 400ms" }, ".hover-3d > :nth-child(n + 2)": { "isolation": "isolate", "z-index": 1, "scale": "1.2" }, ".hover-3d > :first-child": { "overflow": "hidden", "grid-area": "1/1/4/4", "transform": "rotate3d(var(--transform), 0, 10deg)", "transition": "transform var(--ease) 500ms, scale var(--ease) 500ms, outline-color ease-out 500ms", "outline": "0.5px solid #0000", "outline-offset": "-1px", "&:before": { "width": "calc(1 / 3 * 100%)", "height": "calc(1 / 3 * 100%)", "content": '""', "pointer-events": "none", "position": "absolute", "z-index": 1, "scale": "500%", "opacity": 0, "filter": "blur(0.75rem)", "background-image": "radial-gradient(circle at 50%, #fff3 10%, transparent 50%)", "translate": "var(--shine)", "transition": "translate ease-out 400ms, opacity ease-out 400ms" } }, ".hover-3d:hover": { "--ease": "linear(0, 0.708 15.2%, 0.927 23.6%, 1.067 33%, 1.12 41%, 1.13 50.2%, 1.019 83.2%, 1)", "& > :first-child": { "outline-color": "#fff1", "&:before, &:after": { "opacity": 1 } } }, ".hover-3d > :nth-child(2)": { "grid-area": "1/1/2/2" }, ".hover-3d > :nth-child(3)": { "grid-area": "1/2/2/3" }, ".hover-3d > :nth-child(4)": { "grid-area": "1/3/2/4" }, ".hover-3d > :nth-child(5)": { "grid-area": "2/1/3/2" }, ".hover-3d > :nth-child(6)": { "grid-area": "2/3/3/4" }, ".hover-3d > :nth-child(7)": { "grid-area": "3/1/4/2" }, ".hover-3d > :nth-child(8)": { "grid-area": "3/2/4/3" }, ".hover-3d > :nth-child(9)": { "grid-area": "3/3/4/4" }, ".hover-3d:hover > :first-child": { "scale": "1.05" }, ".hover-3d:has( > :nth-child(2):hover)": { "--transform": "-1, 1", "--shine": "0% 0%", "--shadow": "-0.5rem -0.5rem" }, ".hover-3d:has( > :nth-child(3):hover)": { "--transform": "-1, 0", "--shine": "100% 0%", "--shadow": "0rem -0.5rem" }, ".hover-3d:has( > :nth-child(4):hover)": { "--transform": "-1, -1", "--shine": "200% 0%", "--shadow": "0.5rem -0.5rem" }, ".hover-3d:has( > :nth-child(5):hover)": { "--transform": "0, 1", "--shine": "0% 100%", "--shadow": "-0.5rem 0rem" }, ".hover-3d:has( > :nth-child(6):hover)": { "--transform": "0, -1", "--shine": "200% 100%", "--shadow": "0.5rem 0rem" }, ".hover-3d:has( > :nth-child(7):hover)": { "--transform": "1, 1", "--shine": "0% 200%", "--shadow": "-0.5rem 0.5rem" }, ".hover-3d:has( > :nth-child(8):hover)": { "--transform": "1, 0", "--shine": "100% 200%", "--shadow": "0rem 0.5rem" }, ".hover-3d:has( > :nth-child(9):hover)": { "--transform": "1, -1", "--shine": "200% 200%", "--shadow": "0.5rem 0.5rem" } } };

  // vendor/package/components/hover3d/index.js
  var hover3d_default = ({ addComponents, prefix = "" }) => {
    const prefixedhover3d = addPrefix(object_default16, prefix);
    addComponents({ ...prefixedhover3d });
  };

  // vendor/package/components/textrotate/object.js
  var object_default17 = { ".text-rotate": { "height": "1lh", "@layer daisyui.l1.l2.l3": { "display": "inline-block", "overflow": "hidden", "vertical-align": "bottom", "white-space": "nowrap", "transition-property": "none", "--duration": "var(--tw-duration)", "> *": { "display": "grid", "justify-items": "start", "height": "calc(var(--items, 1) * 100%)", "&:has(> *:nth-child(2))": { "--items": "2", "@media (prefers-reduced-motion: no-preference)": { "animation": "rotator var(--duration, 10s) linear(0 0% 49%, 0.5 50% 99%, 1 100% 100%) infinite" }, "@media (prefers-reduced-motion: reduce)": { "animation": "rotator var(--duration, 10s) steps(var(--items), jump-end) infinite" } }, "&:has(> *:nth-child(3))": { "--items": "3", "@media (prefers-reduced-motion: no-preference)": { "animation": "rotator var(--duration, 10s) linear(0 0% 32%, 0.333333 33% 65%, 0.666666 66% 99%, 1 100% 100%) infinite" } }, "&:has(> *:nth-child(4))": { "--items": "4", "@media (prefers-reduced-motion: no-preference)": { "animation": "rotator var(--duration, 10s) linear(0 0% 24%, 0.25 25% 49%, 0.5 50% 74%, 0.75 75% 99%, 1 100% 100%) infinite" } }, "&:has(> *:nth-child(5))": { "--items": "5", "@media (prefers-reduced-motion: no-preference)": { "animation": "rotator var(--duration, 10s) linear(0 0% 19%, 0.2 20% 39%, 0.4 40% 59%, 0.6 60% 79%, 0.8 80% 99%, 1 100% 100%) infinite" } }, "&:has(> *:nth-child(6))": { "--items": "6", "@media (prefers-reduced-motion: no-preference)": { "animation": "rotator var(--duration, 10s) linear( 0 0% 15%, 0.16666 16% 32%, 0.333333 33% 49%, 0.5 50% 65%, 0.666666 66% 82%, 0.833333 83% 99%, 1 100% 100% ) infinite" } }, "> *": { "align-content": "baseline", "clip-path": "inset(0.5px 0px 0.5px 0px)", "&:nth-child(1)": { "translate": "var(--first-item-position)" } } }, "&:hover": { "> *": { "animation-play-state": "paused" } } } }, "@keyframes rotator": { "89.9999%, 100%": { "--first-item-position": "0 0%" }, "90%, 99.9999%": { "--first-item-position": "0 calc(var(--items) * 100%)" }, "100%": { "translate": "0 -100%" } } };

  // vendor/package/components/textrotate/index.js
  var textrotate_default = ({ addComponents, prefix = "" }) => {
    const prefixedtextrotate = addPrefix(object_default17, prefix);
    addComponents({ ...prefixedtextrotate });
  };

  // vendor/package/components/kbd/object.js
  var object_default18 = { ".kbd": { "box-shadow": "none", "@layer daisyui.l1.l2.l3": { "display": "inline-flex", "flex-shrink": 0, "align-items": "center", "justify-content": "center", "border-radius": "var(--radius-field)", "background-color": "var(--color-base-200)", "vertical-align": "middle", "color": "var(--color-base-content)", "padding-inline": "0.5em", "border": "var(--border) solid color-mix(in srgb, var(--color-base-content) 20%, #0000)", "border-bottom": "calc(var(--border) + 1px) solid color-mix(in srgb, var(--color-base-content) 20%, #0000)", "--size": "calc(var(--size-selector, 0.25rem) * 6)", "font-size": "0.875rem", "height": "var(--size)", "min-width": "var(--size)" } }, "@layer daisyui.l1.l2": { ".kbd-xs": { "--size": "calc(var(--size-selector, 0.25rem) * 4)", "font-size": "0.625rem" }, ".kbd-sm": { "--size": "calc(var(--size-selector, 0.25rem) * 5)", "font-size": "0.75rem" }, ".kbd-md": { "--size": "calc(var(--size-selector, 0.25rem) * 6)", "font-size": "0.875rem" }, ".kbd-lg": { "--size": "calc(var(--size-selector, 0.25rem) * 7)", "font-size": "1rem" }, ".kbd-xl": { "--size": "calc(var(--size-selector, 0.25rem) * 8)", "font-size": "1.125rem" } } };

  // vendor/package/components/kbd/index.js
  var kbd_default = ({ addComponents, prefix = "" }) => {
    const prefixedkbd = addPrefix(object_default18, prefix);
    addComponents({ ...prefixedkbd });
  };

  // vendor/package/components/avatar/object.js
  var object_default19 = { "@layer daisyui.l1.l2.l3": { ".avatar-group": { "display": "flex", "overflow": "hidden" }, ".avatar-group .avatar": { "overflow": "hidden", "border-radius": "calc(infinity * 1px)", "border": "4px solid var(--color-base-100)" }, ".avatar": { "position": "relative", "display": "inline-flex", "align-self": "center", "vertical-align": "middle" }, ".avatar > div": { "display": "block", "aspect-ratio": "1 / 1", "overflow": "hidden" }, ".avatar img": { "height": "100%", "width": "100%", "object-fit": "cover" } }, "@layer daisyui.l1.l2": { ".avatar-placeholder > div": { "display": "flex", "align-items": "center", "justify-content": "center" }, ".avatar-online:before": { "content": '""', "position": "absolute", "z-index": 1, "display": "block", "border-radius": "calc(infinity * 1px)", "background-color": "var(--color-success)", "outline": "2px solid var(--color-base-100)", "width": "15%", "height": "15%", "top": "7%", "right": "7%" }, ".avatar-offline:before": { "content": '""', "position": "absolute", "z-index": 1, "display": "block", "border-radius": "calc(infinity * 1px)", "background-color": "var(--color-base-300)", "outline": "2px solid var(--color-base-100)", "width": "15%", "height": "15%", "top": "7%", "right": "7%" } } };

  // vendor/package/components/avatar/index.js
  var avatar_default = ({ addComponents, prefix = "" }) => {
    const prefixedavatar = addPrefix(object_default19, prefix);
    addComponents({ ...prefixedavatar });
  };

  // vendor/package/components/rating/object.js
  var object_default20 = { "@layer daisyui.l1.l2.l3": { ".rating": { "position": "relative", "display": "inline-flex", "vertical-align": "middle", "--size": "var(--size-selector, 0.25rem) * 6" }, ".rating input": { "cursor": "pointer", "appearance": "none" }, ".rating *": { "border-radius": "0", "background-color": "var(--color-base-content)", "opacity": "20%", "width": "calc(var(--size) * 1)", "height": "calc(var(--size))", "@media (prefers-reduced-motion: no-preference)": { "animation": "rating 0.25s ease-out" } }, ".rating .rating-hidden": { "width": "calc(0.25rem * 2)", "background-color": "transparent" }, '.rating :checked, .rating  [aria-checked="true"], .rating  [aria-current="true"], .rating  :has(~ :checked, ~ [aria-checked="true"], ~ [aria-current="true"])': { "opacity": "100%" }, ".rating :focus-visible": { "scale": "1.1", "@media (prefers-reduced-motion: no-preference)": { "transition": "scale 0.2s ease-out" } }, ".rating :active:focus": { "animation": "none", "scale": "1.1" } }, "@layer daisyui.l1.l2": { ".rating-half *": { "width": "calc(var(--size) * 0.5)" }, ".rating-xs": { "--size": "var(--size-selector, 0.25rem) * 4" }, ".rating-sm": { "--size": "var(--size-selector, 0.25rem) * 5" }, ".rating-md": { "--size": "var(--size-selector, 0.25rem) * 6" }, ".rating-lg": { "--size": "var(--size-selector, 0.25rem) * 7" }, ".rating-xl": { "--size": "var(--size-selector, 0.25rem) * 8" } }, "@keyframes rating": { "0%, 40%": { "scale": "1.1", "filter": "brightness(1.05) contrast(1.05)" } } };

  // vendor/package/components/rating/index.js
  var rating_default = ({ addComponents, prefix = "" }) => {
    const prefixedrating = addPrefix(object_default20, prefix);
    addComponents({ ...prefixedrating });
  };

  // vendor/package/components/stat/object.js
  var object_default21 = { "@layer daisyui.l1.l2.l3": { ".stats": { "position": "relative", "display": "inline-grid", "grid-auto-flow": "column", "overflow-x": "auto", "border-radius": "var(--radius-box)" }, ".stat": { "display": "inline-grid", "width": "100%", "column-gap": "calc(0.25rem * 4)", "padding-inline": "calc(0.25rem * 6)", "padding-block": "calc(0.25rem * 4)", "grid-template-columns": "repeat(1, 1fr)" }, ".stat:not(:last-child)": { "border-inline-end": "var(--border) dashed color-mix(in oklab, currentColor 10%, #0000)", "border-block-end": "none" }, ".stat-figure": { "grid-column-start": "2", "grid-row": "span 3 / span 3", "grid-row-start": "1", "place-self": "center", "justify-self": "flex-end" }, ".stat-title": { "grid-column-start": "1", "white-space": "nowrap", "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)", "font-size": "0.75rem" }, ".stat-value": { "grid-column-start": "1", "white-space": "nowrap", "font-size": "2rem", "font-weight": 800 }, ".stat-desc": { "grid-column-start": "1", "white-space": "nowrap", "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)", "font-size": "0.75rem" }, ".stat-actions": { "grid-column-start": "1", "white-space": "nowrap" } }, "@layer daisyui.l1.l2": { ".stats-horizontal": { "grid-auto-flow": "column", "overflow-x": "auto" }, ".stats-horizontal .stat:not(:last-child)": { "border-inline-end": "var(--border) dashed color-mix(in oklab, currentColor 10%, #0000)", "border-block-end": "none" }, ".stats-vertical": { "grid-auto-flow": "row", "overflow-y": "auto" }, ".stats-vertical .stat:not(:last-child)": { "border-inline-end": "none", "border-block-end": "var(--border) dashed color-mix(in oklab, currentColor 10%, #0000)" } } };

  // vendor/package/components/stat/index.js
  var stat_default = ({ addComponents, prefix = "" }) => {
    const prefixedstat = addPrefix(object_default21, prefix);
    addComponents({ ...prefixedstat });
  };

  // vendor/package/components/dropdown/object.js
  var object_default22 = { "@layer daisyui.l1.l2.l3": { ".dropdown": { "position": "relative", "display": "inline-block", "position-area": "var(--anchor-v, block-end) var(--anchor-h, span-inline-end)" }, '.dropdown > :not(:has( ~ [class*="dropdown-content"])):focus': { "--tw-outline-style": "none", "outline-style": "none", "@media (forced-colors: active)": { "outline": "2px solid transparent", "outline-offset": "2px" } }, ".dropdown .dropdown-content": { "position": "absolute" }, ".dropdown.dropdown-close .dropdown-content, .dropdown:not(details, .dropdown-open, .dropdown-hover:hover, :focus-within) .dropdown-content, .dropdown.dropdown-hover:not(:hover) [tabindex]:first-child:focus:not(:focus-visible) ~ .dropdown-content": { "display": "none", "transform-origin": "top", "opacity": "0%", "scale": "95%" }, ".dropdown[popover], .dropdown  .dropdown-content": { "z-index": 999, "@media (prefers-reduced-motion: no-preference)": { "animation": "dropdown 0.2s", "transition-property": "opacity, scale, display, overlay", "transition-behavior": "allow-discrete", "transition-duration": "0.2s", "transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)" } }, "@starting-style": { ".dropdown[popover], .dropdown  .dropdown-content": { "scale": "95%", "opacity": 0 } }, ":is(.dropdown:not(.dropdown-close).dropdown-open, .dropdown:not(.dropdown-close):not(.dropdown-hover):focus, .dropdown:not(.dropdown-close):focus-within) > [tabindex]:first-child": { "pointer-events": "none" }, ":is(.dropdown:not(.dropdown-close).dropdown-open, .dropdown:not(.dropdown-close):not(.dropdown-hover):focus, .dropdown:not(.dropdown-close):focus-within) .dropdown-content": { "opacity": "100%", "scale": "100%" }, ".dropdown:not(.dropdown-close).dropdown-hover:hover .dropdown-content": { "opacity": "100%", "scale": "100%" }, ".dropdown:is(details)": { "overflow": "revert-layer", "summary": { "&::-webkit-details-marker": { "display": "none" } } }, ".dropdown:where([popover])": { "background": "#0000" }, ".dropdown[popover]": { "position": "fixed", "color": "inherit", "@supports not (position-area: bottom)": { "margin": "auto", "&.dropdown-close, &.dropdown-open:not(:popover-open)": { "display": "none", "transform-origin": "top", "opacity": "0%", "scale": "95%" }, "&::backdrop": { "background-color": "color-mix(in oklab, #000 30%, #0000)" } }, "&.dropdown-close, &:not(.dropdown-open, :popover-open)": { "display": "none", "transform-origin": "top", "opacity": "0%", "scale": "95%" } } }, "@layer daisyui.l1.l2": { ".dropdown-start": { "--anchor-h": "span-inline-end" }, ".dropdown-start :where(.dropdown-content)": { "inset-inline-end": "auto", "translate": "0 0", '[dir="rtl"] &': { "translate": "0 0" } }, ".dropdown-start.dropdown-left": { "--anchor-h": "left", "--anchor-v": "span-bottom", ".dropdown-content": { "top": "0px", "bottom": "auto" } }, ".dropdown-start.dropdown-right": { "--anchor-h": "right", "--anchor-v": "span-bottom", ".dropdown-content": { "top": "0px", "bottom": "auto" } }, ".dropdown-center": { "--anchor-h": "center" }, ".dropdown-center :where(.dropdown-content)": { "inset-inline-end": "calc(1/2 * 100%)", "translate": "50% 0", '[dir="rtl"] &': { "translate": "-50% 0" } }, ".dropdown-center.dropdown-left": { "--anchor-h": "left", "--anchor-v": "center", ".dropdown-content": { "top": "auto", "bottom": "calc(1 / 2 * 100%)", "translate": "0 50%" } }, ".dropdown-center.dropdown-right": { "--anchor-h": "right", "--anchor-v": "center", ".dropdown-content": { "top": "auto", "bottom": "calc(1 / 2 * 100%)", "translate": "0 50%" } }, ".dropdown-end": { "--anchor-h": "span-inline-start" }, ".dropdown-end :where(.dropdown-content)": { "inset-inline-end": "calc(0.25rem * 0)", "translate": "0 0", '[dir="rtl"] &': { "translate": "0 0" } }, ".dropdown-end.dropdown-left": { "--anchor-h": "left", "--anchor-v": "span-top", ".dropdown-content": { "top": "auto", "bottom": "0px" } }, ".dropdown-end.dropdown-right": { "--anchor-h": "right", "--anchor-v": "span-top", ".dropdown-content": { "top": "auto", "bottom": "0px" } }, ".dropdown-left": { "--anchor-h": "left", "--anchor-v": "span-bottom" }, ".dropdown-left .dropdown-content": { "inset-inline-end": "100%", "top": "0px", "bottom": "auto", "transform-origin": "100%" }, ".dropdown-right": { "--anchor-h": "right", "--anchor-v": "span-bottom" }, ".dropdown-right .dropdown-content": { "inset-inline-start": "100%", "top": "0px", "bottom": "auto", "transform-origin": "0" }, ".dropdown-bottom": { "--anchor-v": "block-end" }, ".dropdown-bottom .dropdown-content": { "top": "100%", "bottom": "auto", "transform-origin": "top" }, ".dropdown-top": { "--anchor-v": "block-start" }, ".dropdown-top .dropdown-content": { "top": "auto", "bottom": "100%", "transform-origin": "bottom" } }, "@keyframes dropdown": { "0%": { "opacity": 0 } } };

  // vendor/package/components/dropdown/index.js
  var dropdown_default = ({ addComponents, prefix = "" }) => {
    const prefixeddropdown = addPrefix(object_default22, prefix);
    addComponents({ ...prefixeddropdown });
  };

  // vendor/package/components/filter/object.js
  var object_default23 = { "@layer daisyui.l1.l2.l3": { ".filter": { "display": "flex", "flex-wrap": "wrap" }, '.filter [type="radio"]': { "width": "auto" }, ".filter input": { "overflow": "hidden", "opacity": "100%", "scale": "1", "transition": "visibility 0.1s allow-discrete, margin 0.1s, opacity 0.3s, padding 0.3s, border-width 0.1s", "&.filter-reset": { "aspect-ratio": "1 / 1", "&::after": { "--tw-content": '"\xD7"', "content": "var(--tw-content)" } } }, ".filter > input:not(:last-child), .filter  > :not(:last-child) input": { "margin-inline-end": "0.25rem" } }, "@layer daisyui.l1": { '.filter:not(:has(:checked:not(.filter-reset))) :is(.filter-reset, [type="reset"]):not(:focus-visible)': { "visibility": "hidden" }, '.filter:not(:has(:checked:not(.filter-reset))) :is(.filter-reset, [type="reset"]):not(:focus-visible), .filter:not(:has(:focus-visible)):has(:checked:not(.filter-reset, [type="checkbox"])) :is(input, button):not(:checked, .filter-reset, [type="reset"])': { "margin-inline": "0px", "width": "0px", "padding-inline": "0px", "opacity": "0%", "scale": "0", "border-width": "0" } } };

  // vendor/package/components/filter/index.js
  var filter_default = ({ addComponents, prefix = "" }) => {
    const prefixedfilter = addPrefix(object_default23, prefix);
    addComponents({ ...prefixedfilter });
  };

  // vendor/package/components/megamenu/object.js
  var object_default24 = { "@layer daisyui.l1.l2.l3": [{ ".megamenu": { "position": "relative", "display": "flex", "align-items": "center", "overflow": "visible", "width": "unset", "background-color": "transparent", "border-radius": "calc(var(--radius-field) + var(--border))", "--mm-anchor": "--mm1", "--size": "calc(var(--size-field, 0.25rem) * 10)" }, ".megamenu [popovertarget]": { "position": "relative", "isolation": "isolate", "display": "flex", "cursor": "pointer", "align-items": "center", "gap": "calc(0.25rem * 3)", "padding-inline": "var(--mm-p, 1rem)", "height": "var(--size)", "font-size": "var(--fontsize, 0.875rem)", "border": "var(--border) solid transparent", "anchor-name": "var(--mm-anchor)", "transition": "background-color 200ms ease-out, color 200ms ease-out", "&:focus-visible": { "outline": "2px solid var(--color-base-content)", "outline-offset": "2px" }, "&:after": { "--tw-content": '""', "content": "var(--tw-content)", "pointer-events": "none", "inset-inline-end": "1.4rem", "box-shadow": "inset 2px 2px", "transition": "opacity 200ms ease-out, rotate 200ms ease-out", "width": "0.375rem", "height": "0.375rem", "display": "block", "opacity": 0.25, "rotate": "-135deg" }, "&:nth-of-type(1)": { "--mm-anchor": "--mm1" }, "&:nth-of-type(2)": { "--mm-anchor": "--mm2" }, "&:nth-of-type(3)": { "--mm-anchor": "--mm3" }, "&:nth-of-type(4)": { "--mm-anchor": "--mm4" }, "&:nth-of-type(5)": { "--mm-anchor": "--mm5" }, "&:nth-of-type(6)": { "--mm-anchor": "--mm6" }, "&:nth-of-type(7)": { "--mm-anchor": "--mm7" }, "&:nth-of-type(8)": { "--mm-anchor": "--mm8" }, "&:nth-of-type(9)": { "--mm-anchor": "--mm9" }, "&:nth-of-type(10)": { "--mm-anchor": "--mm10" } }, ".megamenu:not(:has([popovertarget]:hover, [popover]:popover-open)) .megamenu-active": { "background-color": "transparent" }, ".megamenu:has([popovertarget]:hover):not(:has([popover]:popover-open)) .megamenu-active, .megamenu:has([popover]:popover-open) .megamenu-active": { "inset": "anchor(var(--mm-anchor) top) anchor(var(--mm-anchor) end) anchor(var(--mm-anchor) bottom) anchor(var(--mm-anchor) start)" }, ".megamenu:has([popovertarget]:nth-of-type(1):hover):not(:has([popover]:popover-open)), .megamenu:has([popover]:nth-of-type(1):popover-open)": { "--mm-anchor": "--mm1" }, ".megamenu:has([popovertarget]:nth-of-type(2):hover):not(:has([popover]:popover-open)), .megamenu:has([popover]:nth-of-type(2):popover-open)": { "--mm-anchor": "--mm2" }, ".megamenu:has([popovertarget]:nth-of-type(3):hover):not(:has([popover]:popover-open)), .megamenu:has([popover]:nth-of-type(3):popover-open)": { "--mm-anchor": "--mm3" }, ".megamenu:has([popovertarget]:nth-of-type(4):hover):not(:has([popover]:popover-open)), .megamenu:has([popover]:nth-of-type(4):popover-open)": { "--mm-anchor": "--mm4" }, ".megamenu:has([popovertarget]:nth-of-type(5):hover):not(:has([popover]:popover-open)), .megamenu:has([popover]:nth-of-type(5):popover-open)": { "--mm-anchor": "--mm5" }, ".megamenu:has([popovertarget]:nth-of-type(6):hover):not(:has([popover]:popover-open)), .megamenu:has([popover]:nth-of-type(6):popover-open)": { "--mm-anchor": "--mm6" }, ".megamenu:has([popovertarget]:nth-of-type(7):hover):not(:has([popover]:popover-open)), .megamenu:has([popover]:nth-of-type(7):popover-open)": { "--mm-anchor": "--mm7" }, ".megamenu:has([popovertarget]:nth-of-type(8):hover):not(:has([popover]:popover-open)), .megamenu:has([popover]:nth-of-type(8):popover-open)": { "--mm-anchor": "--mm8" }, ".megamenu:has([popovertarget]:nth-of-type(9):hover):not(:has([popover]:popover-open)), .megamenu:has([popover]:nth-of-type(9):popover-open)": { "--mm-anchor": "--mm9" }, ".megamenu:has([popovertarget]:nth-of-type(10):hover):not(:has([popover]:popover-open)), .megamenu:has([popover]:nth-of-type(10):popover-open)": { "--mm-anchor": "--mm10" }, ".megamenu [popovertarget]:has(+ [popover]:popover-open):after": { "opacity": 1, "rotate": "45deg" }, ".megamenu [popover]": { "margin-top": "0.25rem", "max-height": "100dvh", "border-style": "var(--tw-border-style)", "border-width": "1px", "border-color": "var(--color-base-300)", "opacity": "0%", "border-radius": "var(--radius-box)", "background-color": "var(--color-base-100)", "position-area": "block-end span-inline-end", "max-block-size": "calc(100% - 0.25rem)", "translate": "0 -0.5rem", "scale": "0.98", "transition": "opacity 200ms ease-out, translate 200ms ease-out, scale 200ms ease-out, display 200ms ease-out allow-discrete, overlay 200ms ease-out allow-discrete", "&:popover-open": { "opacity": "100%", "@starting-style": { "opacity": "0%" } } }, ".megamenu:has([popover]:popover-open) [popover]": { "translate": "0 0", "scale": "1" } }, { ".megamenu-active": { "pointer-events": "none", "position": "absolute", "background-color": "color-mix(in oklab, var(--color-base-content) 10%, transparent)", "border-radius": "var(--radius-field)", "transition": "inset 300ms linear(0, 0.5 10%, 0.9 30%, 1.05 50%, 1.1 75%, 1), background-color 200ms ease-out" } }], "@layer daisyui.l1": { ".megamenu:popover-open": { "position": "fixed", "width": "100%", "flex-direction": "column", "align-items": "flex-start", "overflow-y": "scroll", "border-radius": "0", "padding-top": "calc(0.25rem * 4)", "opacity": "100%", "background-color": "var(--color-base-100)", "margin-top": "var(--mm-mt, 4rem)", "[popovertarget], > [popover]:not(:nth-of-type(1))": { "display": "var(--mm-display, none)" }, "&::backdrop": { "background-color": "var(--mm-backdrop, oklch(0% 0 0/ 0.4))" }, "border-inline-width": "0", "position-area": "block-end", "top": "0", "inset-inline-start": "0", "max-block-size": "80svh", "translate": "0 0", "scale": "1", "transition": "opacity 200ms ease-out, translate 200ms ease-out, scale 200ms ease-out, display 200ms ease-out allow-discrete, overlay 200ms ease-out allow-discrete", "@starting-style": { "opacity": "0%" }, "[popovertarget]": { "pointer-events": "none", "font-size": "0.875rem", "font-weight": 600, "color": "color-mix(in oklab, var(--color-base-content) 40%, transparent)", "&:after": { "content": "none" } }, "[popover]": { "position": "relative", "display": "block", "max-height": "none", "overflow": "visible", "background-color": "transparent", "opacity": "100%", "border": "none" } } }, "@layer daisyui.l1.l2": { ".megamenu-wide": { "anchor-name": "--megamenu" }, ".megamenu-wide:popover-open": { "inset-inline": "0" }, ".megamenu-wide [popover]": { "position-area": "block-end", "position-anchor": "--megamenu", "width": "anchor-size(inline)" }, ".megamenu-full": { "anchor-name": "--megamenu" }, ".megamenu-full:popover-open": { "inset-inline": "0" }, ".megamenu-full [popover]": { "position-area": "block-end", "position-anchor": "--megamenu", "width": "100%", "border-radius": "0", "border-inline-width": "0" }, ".megamenu-vertical": { "position": "relative", "width": "100%", "flex-direction": "column", "align-items": "flex-start", "border-radius": "0", "opacity": "0%", "background-color": "var(--color-base-100)", "border-inline-width": "0", "position-area": "block-end", "max-block-size": "calc(100% - 0.25rem)", "--mm-backdrop": "transparent", "translate": "0 -0.5rem", "scale": "0.98", "transition": "opacity 200ms ease-out, translate 200ms ease-out, scale 200ms ease-out, display 200ms ease-out allow-discrete, overlay 200ms ease-out allow-discrete" }, ".megamenu-vertical:not([popover]:popover-open)": { "position": "revert", "display": "none" }, ".megamenu-vertical:popover-open": { "--mm-mt": "0", "--mm-display": "block" }, ".megamenu-vertical [popovertarget]": { "pointer-events": "none", "font-size": "0.875rem", "font-weight": 600, "color": "color-mix(in oklab, var(--color-base-content) 40%, transparent)", "&:after": { "content": "none" } }, ".megamenu-vertical [popover]": { "position": "relative", "display": "block", "overflow": "visible", "background-color": "transparent", "opacity": "100%", "border": "none" }, ".megamenu-xs": { "--fontsize": "0.6875rem", "--mm-p": "0.5rem", "--size": "calc(var(--size-field, 0.25rem) * 6)" }, ".megamenu-sm": { "--fontsize": "0.75rem", "--mm-p": "0.75rem", "--size": "calc(var(--size-field, 0.25rem) * 8)" }, ".megamenu-md": { "--fontsize": "0.875rem", "--mm-p": "1rem", "--size": "calc(var(--size-field, 0.25rem) * 10)" }, ".megamenu-lg": { "--fontsize": "1.125rem", "--mm-p": "1.25rem", "--size": "calc(var(--size-field, 0.25rem) * 12)" }, ".megamenu-xl": { "--fontsize": "1.375rem", "--mm-p": "1.5rem", "--size": "calc(var(--size-field, 0.25rem) * 14)" } } };

  // vendor/package/components/megamenu/index.js
  var megamenu_default = ({ addComponents, prefix = "" }) => {
    const prefixedmegamenu = addPrefix(object_default24, prefix);
    addComponents({ ...prefixedmegamenu });
  };

  // vendor/package/components/toggle/object.js
  var object_default25 = { "@layer daisyui.l1.l2.l3": { ".toggle": { "border": "var(--border) solid currentColor", "color": "var(--input-color)", "position": "relative", "display": "inline-grid", "flex-shrink": 0, "cursor": "pointer", "appearance": "none", "place-content": "center", "vertical-align": "middle", "webkit-user-select": "none", "user-select": "none", "grid-template-columns": "0fr 1fr 1fr", "--radius-selector-max": "calc(\n      var(--radius-selector) + var(--radius-selector) + var(--radius-selector)\n    )", "border-radius": "calc( var(--radius-selector) + min(var(--toggle-p), var(--radius-selector-max)) + min(var(--border), var(--radius-selector-max)) )", "padding": "var(--toggle-p)", "box-shadow": "0 1px color-mix(in oklab, currentColor calc(var(--depth) * 10%), #0000) inset", "transition": "color 0.3s, grid-template-columns 0.2s", "--input-color": "color-mix(in oklab, var(--color-base-content) 50%, #0000)", "--toggle-p": "calc(var(--size) * 0.125)", "--size": "calc(var(--size-selector, 0.25rem) * 6)", "width": "calc((var(--size) * 2) - (var(--border) + var(--toggle-p)) * 2)", "height": "var(--size)" }, ".toggle > *": { "z-index": 1, "grid-column": "span 1 / span 1", "grid-column-start": "2", "grid-row-start": "1", "height": "100%", "cursor": "pointer", "appearance": "none", "background-color": "transparent", "padding": "calc(0.25rem * 0.5)", "transition": "opacity 0.2s, rotate 0.4s", "border": "none", "&:focus": { "--tw-outline-style": "none", "outline-style": "none", "@media (forced-colors: active)": { "outline": "2px solid transparent", "outline-offset": "2px" } }, "&:nth-child(2)": { "color": "var(--color-base-100)", "rotate": "0deg" }, "&:nth-child(3)": { "color": "var(--color-base-100)", "opacity": "0%", "rotate": "-15deg" } }, ".toggle:has(:checked) > :nth-child(2)": { "opacity": "0%", "rotate": "15deg" }, ".toggle:has(:checked) > :nth-child(3)": { "opacity": "100%", "rotate": "0deg" }, ".toggle:before": { "position": "relative", "inset-inline-start": "calc(0.25rem * 0)", "grid-column-start": "2", "grid-row-start": "1", "aspect-ratio": "1 / 1", "height": "100%", "width": "100%", "border-radius": "var(--radius-selector)", "background-color": "currentcolor", "translate": "0", "--tw-content": '""', "content": "var(--tw-content)", "transition": "background-color 0.1s, translate 0.2s, inset-inline-start 0.2s", "box-shadow": "0 -1px oklch(0% 0 0 / calc(var(--depth) * 0.1)) inset, 0 8px 0 -4px oklch(100% 0 0 / calc(var(--depth) * 0.1)) inset, 0 1px color-mix(in oklab, currentColor calc(var(--depth) * 10%), #0000)", "background-size": "auto, calc(var(--noise) * 100%)", "background-image": "none, var(--fx-noise)" }, "@media (forced-colors: active)": { ".toggle:before": { "outline-style": "var(--tw-outline-style)", "outline-width": "1px", "outline-offset": "calc(1px * -1)" } }, "@media print": { ".toggle:before": { "outline": "0.25rem solid", "outline-offset": "-1rem" } }, ".toggle:focus-visible, .toggle:has(:focus-visible)": { "outline": "2px solid currentColor", "outline-offset": "2px" }, '.toggle:checked, .toggle[aria-checked="true"], .toggle:has( > input:checked)': { "grid-template-columns": "1fr 1fr 0fr", "background-color": "var(--color-base-100)", "--input-color": "var(--color-base-content)", "&:before": { "background-color": "currentcolor" }, "@starting-style": { "&:before": { "opacity": 0 } } }, ".toggle:indeterminate": { "grid-template-columns": "0.5fr 1fr 0.5fr" }, ".toggle:disabled": { "cursor": "not-allowed", "opacity": "30%", "&:before": { "background-color": "transparent", "border": "var(--border) solid currentColor" } } }, "@layer daisyui.l1.l2": { '.toggle-primary:checked, .toggle-primary[aria-checked="true"]': { "--input-color": "var(--color-primary)" }, '.toggle-secondary:checked, .toggle-secondary[aria-checked="true"]': { "--input-color": "var(--color-secondary)" }, '.toggle-accent:checked, .toggle-accent[aria-checked="true"]': { "--input-color": "var(--color-accent)" }, '.toggle-neutral:checked, .toggle-neutral[aria-checked="true"]': { "--input-color": "var(--color-neutral)" }, '.toggle-success:checked, .toggle-success[aria-checked="true"]': { "--input-color": "var(--color-success)" }, '.toggle-warning:checked, .toggle-warning[aria-checked="true"]': { "--input-color": "var(--color-warning)" }, '.toggle-info:checked, .toggle-info[aria-checked="true"]': { "--input-color": "var(--color-info)" }, '.toggle-error:checked, .toggle-error[aria-checked="true"]': { "--input-color": "var(--color-error)" }, '.toggle-xs:is([type="checkbox"]), .toggle-xs:has([type="checkbox"])': { "--size": "calc(var(--size-selector, 0.25rem) * 4)" }, '.toggle-sm:is([type="checkbox"]), .toggle-sm:has([type="checkbox"])': { "--size": "calc(var(--size-selector, 0.25rem) * 5)" }, '.toggle-md:is([type="checkbox"]), .toggle-md:has([type="checkbox"])': { "--size": "calc(var(--size-selector, 0.25rem) * 6)" }, '.toggle-lg:is([type="checkbox"]), .toggle-lg:has([type="checkbox"])': { "--size": "calc(var(--size-selector, 0.25rem) * 7)" }, '.toggle-xl:is([type="checkbox"]), .toggle-xl:has([type="checkbox"])': { "--size": "calc(var(--size-selector, 0.25rem) * 8)" } } };

  // vendor/package/components/toggle/index.js
  var toggle_default = ({ addComponents, prefix = "" }) => {
    const prefixedtoggle = addPrefix(object_default25, prefix);
    addComponents({ ...prefixedtoggle });
  };

  // vendor/package/components/swap/object.js
  var object_default26 = { "@layer daisyui.l1.l2": { ".swap": { "position": "relative", "display": "inline-grid", "cursor": "pointer", "place-content": "center", "vertical-align": "middle", "webkit-user-select": "none", "user-select": "none" }, ".swap input": { "appearance": "none", "border": "none" }, ".swap > *": { "grid-column-start": "1", "grid-row-start": "1", "@media (prefers-reduced-motion: no-preference)": { "transition-property": "transform, rotate, opacity", "transition-duration": "0.2s", "transition-timing-function": "cubic-bezier(0, 0, 0.2, 1)" } }, ".swap .swap-on, .swap  .swap-indeterminate, .swap  input:indeterminate ~ .swap-on": { "opacity": "0%" }, ".swap input:is(:checked, :indeterminate) ~ .swap-off": { "opacity": "0%" }, ".swap input:checked ~ .swap-on, .swap  input:indeterminate ~ .swap-indeterminate": { "opacity": "100%", "backface-visibility": "visible" } }, "@layer daisyui.l1": { ".swap-active .swap-off": { "opacity": "0%" }, ".swap-active .swap-on": { "opacity": "100%" }, ".swap-active.swap-rotate .swap-on": { "rotate": "0deg" }, ".swap-active.swap-rotate .swap-off": { "rotate": "calc(45deg * -1)" }, ".swap-active.swap-flip .swap-on": { "transform": "rotateY(0deg)" }, ".swap-active.swap-flip .swap-off": { "transform": "rotateY(-180deg)", "backface-visibility": "hidden", "opacity": "100%" }, ".swap-rotate .swap-on, .swap-rotate  input:indeterminate ~ .swap-on": { "rotate": "45deg" }, ".swap-rotate input:is(:checked, :indeterminate) ~ .swap-on, .swap-rotate.swap-active .swap-on": { "rotate": "0deg" }, ".swap-rotate input:is(:checked, :indeterminate) ~ .swap-off, .swap-rotate.swap-active .swap-off": { "rotate": "calc(45deg * -1)" }, ".swap-flip": { "transform-style": "preserve-3d", "perspective": "20rem" }, ".swap-flip .swap-on, .swap-flip  .swap-indeterminate, .swap-flip  input:indeterminate ~ .swap-on": { "transform": "rotateY(180deg)", "backface-visibility": "hidden" }, ".swap-flip input:is(:checked, :indeterminate) ~ .swap-on, .swap-flip.swap-active .swap-on": { "transform": "rotateY(0deg)" }, ".swap-flip input:is(:checked, :indeterminate) ~ .swap-off, .swap-flip.swap-active .swap-off": { "transform": "rotateY(-180deg)", "backface-visibility": "hidden", "opacity": "100%" } } };

  // vendor/package/components/swap/index.js
  var swap_default = ({ addComponents, prefix = "" }) => {
    const prefixedswap = addPrefix(object_default26, prefix);
    addComponents({ ...prefixedswap });
  };

  // vendor/package/components/link/object.js
  var object_default27 = { "@layer daisyui.l1.l2.l3": { ".link": { "cursor": "pointer", "text-decoration-line": "underline" }, ".link:focus": { "--tw-outline-style": "none", "outline-style": "none", "@media (forced-colors: active)": { "outline": "2px solid transparent", "outline-offset": "2px" } }, ".link:focus-visible": { "outline": "2px solid currentColor", "outline-offset": "2px" } }, "@layer daisyui.l1.l2": { ".link-hover": { "text-decoration-line": "none" }, "@media (hover: hover)": [{ ".link-hover:hover": { "text-decoration-line": "underline" } }, { ".link-primary:hover": { "color": "color-mix(in oklab, var(--color-primary) 80%, #000)" } }, { ".link-secondary:hover": { "color": "color-mix(in oklab, var(--color-secondary) 80%, #000)" } }, { ".link-accent:hover": { "color": "color-mix(in oklab, var(--color-accent) 80%, #000)" } }, { ".link-neutral:hover": { "color": "color-mix(in oklab, var(--color-neutral) 80%, #000)" } }, { ".link-success:hover": { "color": "color-mix(in oklab, var(--color-success) 80%, #000)" } }, { ".link-info:hover": { "color": "color-mix(in oklab, var(--color-info) 80%, #000)" } }, { ".link-warning:hover": { "color": "color-mix(in oklab, var(--color-warning) 80%, #000)" } }, { ".link-error:hover": { "color": "color-mix(in oklab, var(--color-error) 80%, #000)" } }], ".link-primary": { "color": "var(--color-primary)" }, ".link-secondary": { "color": "var(--color-secondary)" }, ".link-accent": { "color": "var(--color-accent)" }, ".link-neutral": { "color": "var(--color-neutral)" }, ".link-success": { "color": "var(--color-success)" }, ".link-info": { "color": "var(--color-info)" }, ".link-warning": { "color": "var(--color-warning)" }, ".link-error": { "color": "var(--color-error)" } } };

  // vendor/package/components/link/index.js
  var link_default = ({ addComponents, prefix = "" }) => {
    const prefixedlink = addPrefix(object_default27, prefix);
    addComponents({ ...prefixedlink });
  };

  // vendor/package/components/hovergallery/object.js
  var object_default28 = { "@layer daisyui.l1.l2.l3": { ".hover-gallery": { "--items": "1", "grid-template-columns": "repeat(var(--items), 1fr)", "width": "100%", "gap": "1px", "overflow": "hidden" }, ":is(.hover-gallery), .hover-gallery:is(figure)": { "display": "inline-grid" }, ".hover-gallery:has( > :nth-child(3))": { "--items": "2" }, ".hover-gallery:has( > :nth-child(4))": { "--items": "3" }, ".hover-gallery:has( > :nth-child(5))": { "--items": "4" }, ".hover-gallery:has( > :nth-child(6))": { "--items": "5" }, ".hover-gallery:has( > :nth-child(7))": { "--items": "6" }, ".hover-gallery:has( > :nth-child(8))": { "--items": "7" }, ".hover-gallery:has( > :nth-child(9))": { "--items": "8" }, ".hover-gallery:has( > :nth-child(10))": { "--items": "9" }, ".hover-gallery > *": { "opacity": 0, "height": "100%", "grid-row": "1", "object-fit": "cover", "width": "100%", "&:nth-child(1)": { "grid-column": "1 / -1", "opacity": 1 }, "&:nth-child(2)": { "grid-column": "1" }, "&:nth-child(3)": { "grid-column": "2" }, "&:nth-child(4)": { "grid-column": "3" }, "&:nth-child(5)": { "grid-column": "4" }, "&:nth-child(6)": { "grid-column": "5" }, "&:nth-child(7)": { "grid-column": "6" }, "&:nth-child(8)": { "grid-column": "7" }, "&:nth-child(9)": { "grid-column": "8" }, "&:nth-child(10)": { "grid-column": "9" }, "&:nth-child(n + 11)": { "display": "none" } }, ".hover-gallery > *:hover": { "grid-column": "1 / -1", "opacity": 1 }, ".hover-gallery:has(:hover) > :nth-child(1)": { "display": "none" } } };

  // vendor/package/components/hovergallery/index.js
  var hovergallery_default = ({ addComponents, prefix = "" }) => {
    const prefixedhovergallery = addPrefix(object_default28, prefix);
    addComponents({ ...prefixedhovergallery });
  };

  // vendor/package/components/select/object.js
  var object_default29 = { "@layer daisyui.l1.l2.l3": { ".select": { "position": "relative", "display": "inline-flex", "flex-shrink": 1, "appearance": "none", "align-items": "center", "gap": "calc(0.25rem * 1.5)", "background-color": "var(--color-base-100)", "padding-inline-start": "calc(0.25rem * 3)", "padding-inline-end": "calc(0.25rem * 7)", "vertical-align": "middle", "--size": "calc(var(--size-field, 0.25rem) * var(--sl-size-mul, 10))", "--input-color": "color-mix(in oklab, var(--color-base-content) 20%, #0000)", "width": "clamp(3rem, 20rem, 100%)", "height": "var(--size)", "font-size": "max(var(--font-size, 0rem), var(--font-size-min, 0.875rem))", "touch-action": "manipulation", "border-start-start-radius": "var(--join-ss, var(--radius-field))", "border-start-end-radius": "var(--join-se, var(--radius-field))", "border-end-start-radius": "var(--join-es, var(--radius-field))", "border-end-end-radius": "var(--join-ee, var(--radius-field))", "background-image": "linear-gradient(45deg, #0000 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, #0000 50%)", "background-position": "calc(100% - 20px) calc(1px + 50%), calc(100% - 16.1px) calc(1px + 50%)", "background-size": "4px 4px, 4px 4px", "background-repeat": "no-repeat", "white-space": "nowrap", "overflow": "hidden", "text-overflow": "ellipsis", "border": "var(--border) solid var(--input-color, #0000)", "box-shadow": "0 1px color-mix(in oklab, var(--input-color) calc(var(--depth) * 10%), #0000) inset, 0 -1px oklch(100% 0 0 / calc(var(--depth) * 0.1)) inset" }, '[dir="rtl"] .select': { "background-position": "calc(0% + 12px) calc(1px + 50%), calc(0% + 16px) calc(1px + 50%)" }, ".select[multiple]": { "height": "auto", "overflow": "auto", "padding-block": "calc(0.25rem * 3)", "padding-inline-end": "calc(0.25rem * 3)", "background-image": "none" }, ".select select": { "margin-inline-start": "calc(0.25rem * -3)", "margin-inline-end": "calc(0.25rem * -7)", "width": "calc(100% + 2.75rem)", "appearance": "none", "padding-inline-start": "calc(0.25rem * 3)", "padding-inline-end": "calc(0.25rem * 7)", "height": "calc(100% - calc(var(--border) * 2))", "align-items": "center", "background": "inherit", "border-radius": "inherit", "border-style": "none", "&::placeholder": { "color": "var(--color-base-content)", "opacity": "50%" }, "&:focus, &:focus-within": { "--tw-outline-style": "none", "outline-style": "none", "@media (forced-colors: active)": { "outline": "2px solid transparent", "outline-offset": "2px" } }, "&:not(:last-child)": { "margin-inline-end": "calc(0.25rem * -5.5)", "background-image": "none" } }, ".select:focus, .select:focus-within, .select:open": { "--input-color": "var(--color-base-content)", "box-shadow": "0 1px color-mix(in oklab, var(--input-color) calc(var(--depth) * 10%), #0000)", "outline": "2px solid var(--input-color)", "outline-offset": "2px" }, ".select:open": { "background-image": "linear-gradient(135deg, #0000 50%, currentColor 50%), linear-gradient(45deg, currentColor 50%, #0000 50%)" }, ".select:has( > select[disabled]), .select:is(:disabled, [disabled]), fieldset:disabled .select": { "cursor": "not-allowed", "border-color": "var(--color-base-200)", "background-color": "var(--color-base-200)", "&:is(select), :is(select)": { "color": "color-mix(in oklab, var(--color-base-content) 40%, transparent)" }, "box-shadow": "none", "&::placeholder, ::placeholder": { "color": "var(--color-base-content)", "opacity": "20%" } }, ".select:has( > select[disabled]) > select[disabled]": { "cursor": "not-allowed" }, "@supports (appearance: base-select)": { ":is(:is(.select), .select select), :is(:is(.select), .select select)::picker(select)": { "appearance": "base-select" } }, ":is(:is(.select), .select select)::picker(select)": { "color": "inherit", "max-height": "min(24rem, 70dvh)", "margin-inline": "0.5rem", "translate": "-0.5rem 0", "border": "var(--border) solid var(--color-base-200)", "margin-block": "calc(0.25rem * 2)", "border-radius": "var(--radius-box)", "padding": "calc(0.25rem * 2)", "background-color": "inherit", "box-shadow": ["0 2px calc(var(--depth) * 3px) -2px oklch(0% 0 0/0.2)", "0 20px 25px -5px rgb(0 0 0 / calc(var(--depth) * 0.1)), 0 8px 10px -6px rgb(0 0 0 / calc(var(--depth) * 0.1))"] }, ":is(:is(.select), .select select)::picker-icon": { "display": "none" }, ":is(:is(.select), .select select) selectedcontent": { "width": "100%", "overflow": "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }, ":is(:is(.select), .select select) optgroup": { "padding-top": "0.5em", "option": { "&:nth-child(1)": { "margin-top": "0.5em" } } }, ":is(:is(.select), .select select) option": { "border-radius": "var(--radius-field)", "padding-block": "calc(0.25rem * 1.5)", "padding-inline": "calc(0.25rem * var(--option-px, 3))", "transition-property": "color, background-color", "transition-duration": "0.2s", "transition-timing-function": "cubic-bezier(0, 0, 0.2, 1)", "white-space": "normal", "&:not(:disabled)": { "&:hover, &:focus-visible": { "cursor": "pointer", "background-color": "color-mix(in oklab, var(--color-base-content) 10%, transparent)", "--tw-outline-style": "none", "outline-style": "none", "@media (forced-colors: active)": { "outline": "2px solid transparent", "outline-offset": "2px" } }, "&:active": { "background-color": "var(--color-neutral)", "color": "var(--color-neutral-content)", "box-shadow": "0 2px calc(var(--depth) * 3px) -2px var(--color-neutral)" } } }, '[dir="rtl"] .select::picker(select), [dir="rtl"] .select  select::picker(select)': { "translate": "0.5rem 0" } }, "@layer daisyui.l1.l2": { ".select-ghost": { "background-color": "transparent", "transition": "background-color 0.2s", "box-shadow": "none", "border-color": "#0000" }, ".select-ghost:focus, .select-ghost:focus-within, .select-ghost:open": { "background-color": "var(--color-base-100)", "color": "var(--color-base-content)", "border-color": "#0000", "box-shadow": "none" }, ".select-ghost::picker(select)": { "background-color": "var(--color-base-100)", "color": "var(--color-base-content)" }, ":is(.select-neutral), .select-neutral:focus, .select-neutral:focus-within, .select-neutral:open": { "--input-color": "var(--color-neutral)" }, ":is(.select-primary), .select-primary:focus, .select-primary:focus-within, .select-primary:open": { "--input-color": "var(--color-primary)" }, ":is(.select-secondary), .select-secondary:focus, .select-secondary:focus-within, .select-secondary:open": { "--input-color": "var(--color-secondary)" }, ":is(.select-accent), .select-accent:focus, .select-accent:focus-within, .select-accent:open": { "--input-color": "var(--color-accent)" }, ":is(.select-info), .select-info:focus, .select-info:focus-within, .select-info:open": { "--input-color": "var(--color-info)" }, ":is(.select-success), .select-success:focus, .select-success:focus-within, .select-success:open": { "--input-color": "var(--color-success)" }, ":is(.select-warning), .select-warning:focus, .select-warning:focus-within, .select-warning:open": { "--input-color": "var(--color-warning)" }, ":is(.select-error), .select-error:focus, .select-error:focus-within, .select-error:open": { "--input-color": "var(--color-error)" }, ".select-xs": { "--sl-size-mul": "6", "--font-size-min": "0.6875rem", "--option-px": "2" }, ".floating-label:has(.select-xs)": { "--top-mul": "3", "--font-size": "0.6875rem" }, ".select-sm": { "--sl-size-mul": "8", "--font-size-min": "0.75rem", "--option-px": "2.5" }, ".floating-label:has(.select-sm)": { "--top-mul": "4", "--font-size": "0.75rem" }, ".select-md": { "--sl-size-mul": "10", "--font-size-min": "0.875rem", "--option-px": "3" }, ".floating-label:has(.select-md)": { "--top-mul": "5", "--font-size": "0.875rem" }, ".select-lg": { "--sl-size-mul": "12", "--font-size-min": "1.125rem", "--option-px": "4" }, ".floating-label:has(.select-lg)": { "--top-mul": "6", "--font-size": "1.125rem" }, ".select-xl": { "--sl-size-mul": "14", "--font-size-min": "1.375rem", "--option-px": "5" }, ".floating-label:has(.select-xl)": { "--top-mul": "7", "--font-size": "1.375rem" } } };

  // vendor/package/components/select/index.js
  var select_default = ({ addComponents, prefix = "" }) => {
    const prefixedselect = addPrefix(object_default29, prefix);
    addComponents({ ...prefixedselect });
  };

  // vendor/package/components/badge/object.js
  var object_default30 = { "@layer daisyui.l1.l2.l3": { ".badge": { "display": "inline-flex", "flex-shrink": 0, "align-items": "center", "justify-content": "center", "gap": "calc(0.25rem * 2)", "border-radius": "var(--radius-selector)", "vertical-align": "middle", "color": "var(--badge-fg)", "border": "var(--border) solid var(--badge-color, var(--color-base-200))", "font-size": "0.875rem", "width": "fit-content", "background-size": "auto, calc(var(--noise) * 100%)", "background-image": "none, var(--fx-noise)", "background-color": "var(--badge-bg)", "--badge-bg": "var(--badge-color, var(--color-base-100))", "--badge-fg": "var(--color-base-content)", "--size": "calc(var(--size-selector, 0.25rem) * 6)", "height": "var(--size)", "padding-inline": "calc(var(--size) / 2 - var(--border))" } }, "@layer daisyui.l1.l2": { ".badge-outline": { "color": "var(--badge-color)", "--badge-bg": "#0000", "background-image": "none", "border-color": "currentColor" }, ".badge-dash": { "color": "var(--badge-color)", "--badge-bg": "#0000", "background-image": "none", "border-color": "currentColor", "border-style": "dashed" }, ".badge-soft": { "color": "var(--badge-color, var(--color-base-content))", "background-color": "color-mix( in oklab, var(--badge-color, var(--color-base-content)) 8%, var(--color-base-100) )", "border-color": "color-mix( in oklab, var(--badge-color, var(--color-base-content)) 10%, var(--color-base-100) )", "background-image": "none" }, ".badge-primary": { "--badge-color": "var(--color-primary)", "--badge-fg": "var(--color-primary-content)" }, ".badge-secondary": { "--badge-color": "var(--color-secondary)", "--badge-fg": "var(--color-secondary-content)" }, ".badge-accent": { "--badge-color": "var(--color-accent)", "--badge-fg": "var(--color-accent-content)" }, ".badge-neutral": { "--badge-color": "var(--color-neutral)", "--badge-fg": "var(--color-neutral-content)" }, ".badge-info": { "--badge-color": "var(--color-info)", "--badge-fg": "var(--color-info-content)" }, ".badge-success": { "--badge-color": "var(--color-success)", "--badge-fg": "var(--color-success-content)" }, ".badge-warning": { "--badge-color": "var(--color-warning)", "--badge-fg": "var(--color-warning-content)" }, ".badge-error": { "--badge-color": "var(--color-error)", "--badge-fg": "var(--color-error-content)" }, ".badge-ghost": { "border-color": "var(--color-base-200)", "background-color": "var(--color-base-200)", "color": "var(--color-base-content)", "background-image": "none" }, ".badge-xs": { "--size": "calc(var(--size-selector, 0.25rem) * 4)", "font-size": "0.625rem" }, ".badge-sm": { "--size": "calc(var(--size-selector, 0.25rem) * 5)", "font-size": "0.75rem" }, ".badge-md": { "--size": "calc(var(--size-selector, 0.25rem) * 6)", "font-size": "0.875rem" }, ".badge-lg": { "--size": "calc(var(--size-selector, 0.25rem) * 7)", "font-size": "1rem" }, ".badge-xl": { "--size": "calc(var(--size-selector, 0.25rem) * 8)", "font-size": "1.125rem" } } };

  // vendor/package/components/badge/index.js
  var badge_default = ({ addComponents, prefix = "" }) => {
    const prefixedbadge = addPrefix(object_default30, prefix);
    addComponents({ ...prefixedbadge });
  };

  // vendor/package/components/mockup/object.js
  var object_default31 = { "@layer daisyui.l1.l2.l3": { ".mockup-code": { "position": "relative", "overflow": "hidden", "overflow-x": "auto", "border-radius": "var(--radius-box)", "background-color": "var(--color-neutral)", "padding-block": "calc(0.25rem * 5)", "color": "var(--color-neutral-content)", "font-size": "0.875rem", "direction": "ltr" }, ".mockup-code:before": { "content": '""', "margin-bottom": "calc(0.25rem * 4)", "display": "block", "height": "calc(0.25rem * 3)", "width": "calc(0.25rem * 3)", "border-radius": "calc(infinity * 1px)", "opacity": "30%", "box-shadow": "1.4em 0, 2.8em 0, 4.2em 0" }, ".mockup-code pre": { "padding-right": "calc(0.25rem * 5)", "width": "max-content", "min-width": "100%", "&:before": { "content": '""', "margin-right": "2ch" }, "&[data-prefix]": { "&:before": { "--tw-content": "attr(data-prefix)", "content": "var(--tw-content)", "display": "inline-block", "width": "calc(0.25rem * 8)", "text-align": "right", "opacity": "50%" } } }, ".mockup-window": { "position": "relative", "display": "flex", "flex-direction": "column", "overflow": "hidden", "overflow-x": "auto", "border-radius": "var(--radius-box)", "padding-top": "calc(0.25rem * 5)" }, ".mockup-window:before": { "content": '""', "margin-bottom": "calc(0.25rem * 4)", "display": "block", "aspect-ratio": "1 / 1", "height": "calc(0.25rem * 3)", "flex-shrink": 0, "align-self": "flex-start", "border-radius": "calc(infinity * 1px)", "opacity": "30%", "box-shadow": "1.4em 0, 2.8em 0, 4.2em 0" }, '[dir="rtl"] .mockup-window:before': { "align-self": "flex-end" }, ".mockup-window pre[data-prefix]:before": { "--tw-content": "attr(data-prefix)", "content": "var(--tw-content)", "display": "inline-block", "text-align": "right" }, ".mockup-browser": { "position": "relative", "overflow": "hidden", "overflow-x": "auto", "border-radius": "var(--radius-box)" }, ".mockup-browser pre[data-prefix]:before": { "--tw-content": "attr(data-prefix)", "content": "var(--tw-content)", "display": "inline-block", "text-align": "right" }, ".mockup-browser .mockup-browser-toolbar": { "margin-block": "calc(0.25rem * 3)", "display": "inline-flex", "width": "100%", "align-items": "center", "padding-right": "1.4em", '&:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)': { "flex-direction": "row-reverse" }, "&:before": { "content": '""', "margin-right": "4.8rem", "display": "inline-block", "aspect-ratio": "1 / 1", "height": "calc(0.25rem * 3)", "border-radius": "calc(infinity * 1px)", "opacity": "30%", "box-shadow": "1.4em 0, 2.8em 0, 4.2em 0" }, ".input": { "margin-inline": "auto", "display": "flex", "height": "100%", "align-items": "center", "gap": "calc(0.25rem * 2)", "overflow": "hidden", "background-color": "var(--color-base-200)", "text-overflow": "ellipsis", "white-space": "nowrap", "font-size": "0.75rem", "direction": "ltr", "&:before": { "content": '""', "width": "calc(0.25rem * 4)", "height": "calc(0.25rem * 4)", "opacity": "50%", "background-color": "currentColor", "mask": `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z' clip-rule='evenodd' /%3E%3C/svg%3E") no-repeat center`, "mask-size": "contain" } } }, ".mockup-phone": { "display": "inline-grid", "justify-items": "center", "border": "5px solid #6b6b6b", "border-radius": "65px", "background-color": "#000", "padding": "6px", "overflow": "hidden", "width": "100%", "max-width": "462px", "aspect-ratio": "462 / 978" }, "@supports (corner-shape: superellipse(1.45))": { ".mockup-phone": { "border-radius": "90px", "corner-shape": "superellipse(1.45)" } }, ".mockup-phone-camera": { "grid-column": "1/1", "grid-row": "1/1", "background": "#000", "height": "3.7%", "width": "28%", "border-radius": "17px", "z-index": 1, "margin-top": "3%" }, ".mockup-phone-display": { "border-radius": "54px", "grid-column": "1/1", "grid-row": "1/1", "overflow": "hidden", "width": "100%", "height": "100%" }, "@supports (corner-shape: superellipse(1.87))": { ".mockup-phone-display": { "border-radius": "101px", "corner-shape": "superellipse(1.87)" } }, ".mockup-phone-display > img": { "width": "100%", "height": "100%", "object-fit": "cover" } } };

  // vendor/package/components/mockup/index.js
  var mockup_default = ({ addComponents, prefix = "" }) => {
    const prefixedmockup = addPrefix(object_default31, prefix);
    addComponents({ ...prefixedmockup });
  };

  // vendor/package/components/calendar/object.js
  var object_default32 = { "@layer daisyui.l1.l2.l3": { ".cally": { "font-size": "0.7rem" }, ".cally::part(container)": { "padding": "0.5rem 1rem", "user-select": "none" }, ".cally ::part(th)": { "font-weight": "normal", "block-size": "auto" }, ".cally::part(header)": { "direction": "ltr" }, ".cally ::part(head)": { "opacity": 0.5, "font-size": "0.7rem" }, ".cally::part(button)": { "border-radius": "var(--radius-field)", "border": "none", "padding": "0.5rem", "background": "#0000" }, ".cally::part(button):hover": { "background": "var(--color-base-200)" }, ".cally ::part(day)": { "border-radius": "var(--radius-field)", "font-size": "0.7rem" }, ".cally ::part(day):hover": { "background": "var(--color-base-200)" }, ".cally ::part(button day today)": { "background": "var(--color-primary)", "color": "var(--color-primary-content)" }, ".cally ::part(button day today):hover": { "background": "var(--color-primary)" }, ".cally ::part(selected)": { "color": "var(--color-base-100)", "background": "var(--color-base-content)", "border-radius": "var(--radius-field)" }, ".cally ::part(selected):hover": { "background": "var(--color-base-content)" }, ".cally ::part(range-inner)": { "border-radius": "0" }, ".cally ::part(range-start)": { "border-start-end-radius": "0", "border-end-end-radius": "0" }, ".cally ::part(range-end)": { "border-start-start-radius": "0", "border-end-start-radius": "0" }, ".cally ::part(range-start range-end)": { "border-radius": "var(--radius-field)" }, ".cally calendar-month": { "width": "100%" }, ".react-day-picker": { "user-select": "none", "background-color": "var(--color-base-100)", "border-radius": "var(--radius-box)", "border": "var(--border) solid var(--color-base-200)", "font-size": "0.75rem", "display": "inline-block", "position": "relative", "overflow": "clip" }, '.react-day-picker[dir="rtl"] .rdp-nav .rdp-chevron': { "transform-origin": "50%", "transform": "rotate(180deg)" }, ".react-day-picker *": { "box-sizing": "border-box" }, ".react-day-picker .rdp-day": { "width": "2.25rem", "height": "2.25rem", "text-align": "center" }, ".react-day-picker .rdp-day_button": { "cursor": "pointer", "font": "inherit", "color": "inherit", "width": "2.25rem", "height": "2.25rem", "border": "2px solid #0000", "border-radius": "var(--radius-field)", "background": "0 0", "justify-content": "center", "align-items": "center", "margin": "0", "padding": "0", "display": "flex", "&:disabled": { "cursor": "revert" }, "&:hover": { "background-color": "var(--color-base-200)" }, '&:disabled:hover, &[aria-disabled="true"]:hover': { "background-color": "transparent", "cursor": "not-allowed" } }, ".react-day-picker .rdp-caption_label": { "z-index": 1, "white-space": "nowrap", "border": "0", "align-items": "center", "display": "inline-flex", "position": "relative" }, ".react-day-picker .rdp-button_next": { "border-radius": "var(--radius-field)", "&:hover": { "background-color": "var(--color-base-200)" } }, ".react-day-picker .rdp-button_previous": { "border-radius": "var(--radius-field)", "&:hover": { "background-color": "var(--color-base-200)" } }, ".react-day-picker .rdp-button_next, .react-day-picker  .rdp-button_previous": { "cursor": "pointer", "font": "inherit", "color": "inherit", "appearance": "none", "width": "2.25rem", "height": "2.25rem", "background": "0 0", "border": "none", "justify-content": "center", "align-items": "center", "margin": "0", "padding": "0", "display": "inline-flex", "position": "relative", '&:disabled, &[aria-disabled="true"]': { "cursor": "revert", "opacity": 0.5 }, '&:disabled:hover, &[aria-disabled="true"]:hover': { "background-color": "transparent" } }, ".react-day-picker .rdp-chevron": { "fill": "var(--color-base-content)", "width": "1rem", "height": "1rem", "display": "inline-block" }, ".react-day-picker .rdp-dropdowns": { "align-items": "center", "gap": "0.5rem", "display": "inline-flex", "position": "relative" }, ".react-day-picker .rdp-dropdown": { "z-index": 2, "opacity": 0, "appearance": "none", "cursor": "inherit", "line-height": "inherit", "border": "none", "width": "100%", "margin": "0", "padding": "0", "position": "absolute", "inset-block": "0", "inset-inline-start": "0", "&:focus-visible": { "~ .rdp-caption_label": { "outline": ["5px auto highlight", "5px auto -webkit-focus-ring-color"] } } }, ".react-day-picker .rdp-dropdown_root": { "align-items": "center", "display": "inline-flex", "position": "relative", '&[data-disabled="true"]': { ".rdp-chevron": { "opacity": 0.5 } } }, ".react-day-picker .rdp-month_caption": { "height": "2.75rem", "font-size": "0.75rem", "font-weight": "inherit", "place-content": "center", "display": "flex" }, ".react-day-picker .rdp-months": { "gap": "2rem", "flex-wrap": "wrap", "max-width": "fit-content", "padding": "0.5rem", "display": "flex", "position": "relative" }, ".react-day-picker .rdp-month_grid": { "border-collapse": "collapse" }, ".react-day-picker .rdp-nav": { "height": "2.75rem", "inset-block-start": "0", "inset-inline-end": "0", "justify-content": "space-between", "align-items": "center", "width": "100%", "padding-inline": "0.5rem", "display": "flex", "position": "absolute", "top": "0.25rem" }, ".react-day-picker .rdp-weekday": { "opacity": 0.6, "padding": "0.5rem 0rem", "text-align": "center", "font-size": "smaller", "font-weight": 500 }, ".react-day-picker .rdp-week_number": { "opacity": 0.6, "height": "2.25rem", "width": "2.25rem", "border": "none", "border-radius": "100%", "text-align": "center", "font-size": "small", "font-weight": 400 }, ".react-day-picker .rdp-today:not(.rdp-outside) .rdp-day_button": { "background": "var(--color-primary)", "color": "var(--color-primary-content)" }, ".react-day-picker .rdp-selected": { "font-weight": "inherit", "font-size": "0.75rem", ".rdp-day_button": { "color": "var(--color-base-100)", "background-color": "var(--color-base-content)", "border-radius": "var(--radius-field)", "border": "none", "&:hover": { "background-color": "var(--color-base-content)" } } }, ".react-day-picker .rdp-outside": { "opacity": 0.75 }, ".react-day-picker .rdp-disabled": { "opacity": 0.5 }, ".react-day-picker .rdp-hidden": { "visibility": "hidden", "color": "var(--color-base-content)" }, ".react-day-picker .rdp-range_start .rdp-day_button": { "border-radius": "var(--radius-field) 0 0 var(--radius-field)", "background-color": "var(--color-base-content)", "color": "var(--color-base-100)" }, ".react-day-picker .rdp-range_middle": { "background-color": "var(--color-base-200)" }, ".react-day-picker .rdp-range_middle .rdp-day_button": { "border": "unset", "border-radius": "unset", "color": "inherit", "background-color": "transparent", "&:hover": { "background-color": "transparent" } }, ".react-day-picker .rdp-range_end": { "color": "var(--color-base-content)", ".rdp-day_button": { "border-radius": "0 var(--radius-field) var(--radius-field) 0" } }, ".react-day-picker .rdp-range_end .rdp-day_button": { "background-color": "var(--color-base-content)", "color": "var(--color-base-100)" }, ".react-day-picker .rdp-range_start.rdp-range_end": { "background": "revert" }, ".react-day-picker .rdp-focusable": { "cursor": "pointer" }, ".react-day-picker .rdp-footer": { "border-top": "var(--border) solid var(--color-base-200)", "padding": "0.5rem" }, ".pika-single:is(div)": { "user-select": "none", "font-size": "0.75rem", "z-index": 999, "display": "inline-block", "position": "relative", "color": "var(--color-base-content)", "background-color": "var(--color-base-100)", "border-radius": "var(--radius-box)", "border": "var(--border) solid var(--color-base-200)", "padding": "0.5rem", "&:before, &:after": { "content": '""', "display": "table" }, "&:after": { "clear": "both" }, "&.is-hidden": { "display": "none" }, "&.is-bound": { "position": "absolute" }, ".pika-lendar": { "css-float": "left" }, ".pika-title": { "position": "relative", "text-align": "center", "select": { "cursor": "pointer", "position": "absolute", "z-index": 999, "margin": "0", "left": "0", "top": "5px", "opacity": 0 } }, ".pika-label": { "display": "inline-block", "position": "relative", "z-index": 999, "overflow": "hidden", "margin": "0", "padding": "5px 3px", "background-color": "var(--color-base-100)" }, ".pika-prev, .pika-next": { "display": "block", "cursor": "pointer", "position": "absolute", "top": "0", "outline": "none", "border": "0", "width": "2.25rem", "height": "2.25rem", "color": "#0000", "font-size": "1.2em", "border-radius": "var(--radius-field)", "&:hover": { "background-color": "var(--color-base-200)" }, "&.is-disabled": { "cursor": "default", "opacity": 0.2 }, "&:before": { "display": "inline-block", "width": "2.25rem", "height": "2.25rem", "line-height": 2.25, "color": "var(--color-base-content)" } }, ".pika-prev": { "left": "0", "&:before": { "--tw-content": '"\u2039"', "content": "var(--tw-content)" } }, ".pika-next": { "right": "0", "&:before": { "--tw-content": '"\u203A"', "content": "var(--tw-content)" } }, ".pika-select": { "display": "inline-block" }, ".pika-table": { "width": "100%", "border-collapse": "collapse", "border-spacing": "0", "border": "0", "th, td": { "padding": "0" }, "th": { "opacity": 0.6, "text-align": "center", "width": "2.25rem", "height": "2.25rem" } }, ".pika-button": { "cursor": "pointer", "display": "block", "outline": "none", "border": "0", "margin": "0", "width": "2.25rem", "height": "2.25rem", "padding": "5px", "text-align": ["right", "center"] }, ".pika-week": { "color": "var(--color-base-content)" }, ".is-today": { ".pika-button": { "background": "var(--color-primary)", "color": "var(--color-primary-content)" } }, ".is-selected, .has-event": { ".pika-button": { "&, &:hover": { "color": "var(--color-base-100)", "background-color": "var(--color-base-content)", "border-radius": "var(--radius-field)" } } }, ".has-event": { ".pika-button": { "background": "var(--color-primary)" } }, ".is-disabled, .is-inrange": { ".pika-button": { "background": "var(--color-base-200)" } }, ".is-startrange": { ".pika-button": { "color": "var(--color-base-100)", "background": "var(--color-base-content)", "border-radius": "var(--radius-field)" } }, ".is-endrange": { ".pika-button": { "color": "var(--color-base-100)", "background": "var(--color-base-content)", "border-radius": "var(--radius-field)" } }, ".is-disabled": { ".pika-button": { "pointer-events": "none", "cursor": "default", "color": "var(--color-base-content)", "opacity": 0.3 } }, ".is-outside-current-month": { ".pika-button": { "color": "var(--color-base-content)", "opacity": 0.3 } }, ".is-selection-disabled": { "pointer-events": "none", "cursor": "default" }, ".pika-button:hover, .pika-row.pick-whole-week:hover .pika-button": { "color": "var(--color-base-content)", "background-color": "var(--color-base-200)", "border-radius": "var(--radius-field)" }, ".pika-table abbr": { "text-decoration": "none", "font-weight": "normal" } }, ".vc": { "position": "relative", "box-sizing": "border-box", "display": "inline-flex", "min-width": "286px", "flex-direction": "column", "border-radius": "var(--radius-box)", "border": "var(--border) solid var(--color-base-200)", "background-color": "var(--color-base-100)", "color": "var(--color-base-content)", "padding": "1rem", "opacity": 1, "transition-property": "opacity", "transition-duration": "0.2s", "user-select": "none" }, '.vc:focus-visible, .vc  button:focus-visible, .vc  [tabindex="0"]:focus-visible': { "border-radius": "var(--radius-field)", "outline": "1px solid var(--color-primary)", "outline-offset": "-1px" }, ".vc[data-vc-calendar-hidden]": { "pointer-events": "none", "opacity": 0, "*": { "pointer-events": "none !important" } }, ".vc[data-vc-input]": { "position": "absolute", "box-shadow": "0 9px 20px color-mix(in oklab, var(--color-base-content) 10%, transparent)", '&[data-vc-position="bottom"]': { "margin-top": "0.25rem" }, '&[data-vc-position="top"]': { "margin-top": "-0.25rem" } }, '.vc [data-vc="controls"]': { "pointer-events": "none", "position": "absolute", "inset-inline": "0", "inset-block-start": "0", "z-index": 20, "box-sizing": "content-box", "display": "flex", "align-items": "center", "justify-content": "space-between", "padding": "1.25rem 1rem 0" }, ".vc [data-vc-arrow], .vc  .vc-arrow": { "pointer-events": "auto", "position": "relative", "display": "block", "height": "1.5rem", "width": "1.5rem", "cursor": "pointer", "border": "0", "border-radius": "var(--radius-field)", "background-color": "transparent", "color": "var(--color-base-content)", "&:hover": { "background-color": "var(--color-base-200)" }, "&:hover::before": { "opacity": 0.6 }, "&::before": { "content": '""', "position": "absolute", "inset-inline-start": "50%", "inset-block-start": "50%", "height": "0.5rem", "width": "0.5rem", "border-color": "currentColor", "border-style": "solid", "border-width": "0 2px 2px 0", "background-repeat": "no-repeat", "background-position": "center" }, '&[data-vc-arrow="prev"]::before': { "transform": "translate(-35%, -50%) rotate(135deg)" }, '&[data-vc-arrow="next"]::before': { "transform": "translate(-65%, -50%) rotate(-45deg)" } }, '.vc [data-vc="grid"]': { "display": "flex", "flex-grow": 1, "flex-wrap": "wrap", "gap": "1.75rem", '&[data-vc-grid="hidden"]': { '[data-vc="column"]': { "pointer-events": "none", "opacity": 0.3 }, '[data-vc="column"][data-vc-column="month"], [data-vc="column"][data-vc-column="year"]': { "pointer-events": "auto", "opacity": 1 } } }, '.vc [data-vc="column"]': { "display": "flex", "min-width": "240px", "flex-grow": 1, "flex-direction": "column" }, '.vc [data-vc="header"]': { "position": "relative", "margin-bottom": "0.75rem", "display": "flex", "align-items": "center" }, '.vc [data-vc-header="content"], .vc  .vc-header__content': { "color": "var(--color-base-content)" }, '.vc [data-vc-header="content"]': { "display": "grid", "grid-auto-flow": "column", "grid-auto-columns": "max-content", "flex-grow": 1, "align-items": "center", "justify-content": "center", "padding-inline": "1rem", "white-space": "pre-wrap" }, '.vc [data-vc="month"], .vc  [data-vc="year"], .vc  .vc-month, .vc  .vc-year': { "color": "var(--color-base-content)", "&:hover": { "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)" }, "&:disabled": { "color": "color-mix(in oklab, var(--color-base-content) 30%, transparent)" } }, '.vc [data-vc="month"], .vc  [data-vc="year"]': { "cursor": "pointer", "border": "0", "border-radius": "var(--radius-field)", "background-color": "transparent", "padding": "0.25rem", "font-size": "0.875rem", "font-weight": 600, "&:hover": { "background-color": "var(--color-base-200)" }, "&:disabled": { "pointer-events": "none", "opacity": 0.4 } }, '.vc [data-vc="wrapper"], .vc  [data-vc="content"]': { "display": "flex", "flex-grow": 1 }, '.vc [data-vc="content"]': { "flex-direction": "column" }, '.vc [data-vc="months"], .vc  [data-vc="years"]': { "display": "grid", "flex-grow": 1, "align-items": "center", "gap": "1rem 0.25rem" }, '.vc [data-vc="months"]': { "grid-template-columns": "repeat(4, minmax(0, 1fr))" }, '.vc [data-vc="years"]': { "grid-template-columns": "repeat(5, minmax(0, 1fr))" }, ".vc [data-vc-months-month], .vc  [data-vc-years-year], .vc  .vc-months__month, .vc  .vc-years__year": { "background-color": "var(--color-base-100)", "color": "color-mix(in oklab, var(--color-base-content) 70%, transparent)", "&:hover": { "background-color": "var(--color-base-200)", "color": "var(--color-base-content)" }, "&:disabled": { "color": "color-mix(in oklab, var(--color-base-content) 30%, transparent)", "opacity": 0.8, "&:hover": { "color": "color-mix(in oklab, var(--color-base-content) 30%, transparent)" } }, "&[data-vc-months-month-selected], &[data-vc-years-year-selected]": { "background-color": "var(--color-primary)", "color": "var(--color-primary-content)", "&:hover": { "background-color": "var(--color-primary)", "color": "var(--color-primary-content)" } } }, ".vc [data-vc-months-month], .vc  [data-vc-years-year]": { "display": "flex", "height": "2.5rem", "cursor": "pointer", "align-items": "center", "justify-content": "center", "overflow-wrap": "anywhere", "border": "0", "border-radius": "var(--radius-field)", "padding": "0.25rem", "text-align": "center", "font-size": "0.75rem", "font-weight": 600, "&:disabled": { "pointer-events": "none", "opacity": 0.4 } }, '.vc [data-vc-week="numbers"]': { "display": "flex", "flex-direction": "column" }, '.vc [data-vc-week-numbers="title"], .vc  .vc-week-numbers__title': { "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)" }, '.vc [data-vc-week-numbers="title"]': { "margin-bottom": "0.5rem", "display": "flex", "align-items": "center", "justify-content": "center", "font-size": "0.75rem", "font-weight": 700 }, '.vc [data-vc-week-numbers="content"]': { "display": "grid", "grid-auto-flow": "row", "align-items": "center", "justify-items": "center", "row-gap": "0.25rem" }, ".vc [data-vc-week-number], .vc  .vc-week-number": { "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)", "&:hover": { "color": "color-mix(in oklab, var(--color-base-content) 80%, transparent)" } }, ".vc [data-vc-week-number]": { "margin": "0", "display": "flex", "min-height": "1.875rem", "min-width": "1.875rem", "width": "100%", "cursor": "pointer", "align-items": "center", "justify-content": "center", "border": "0", "background-color": "transparent", "padding": "0", "font-size": "0.75rem", "font-weight": 600 }, '.vc [data-vc="week"]': { "margin-bottom": "0.5rem", "display": "grid", "grid-template-columns": "repeat(7, 1fr)", "justify-items": "center" }, ".vc [data-vc-week-day], .vc  .vc-week__day": { "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)" }, ".vc [data-vc-week-day]": { "margin": "0", "display": "flex", "min-width": "1.875rem", "width": "100%", "align-items": "center", "justify-content": "center", "border": "0", "background-color": "transparent", "padding": "0", "font-size": "0.75rem", "font-weight": "normal" }, ".vc button[data-vc-week-day], .vc  button.vc-week__day": { "cursor": "pointer", "&:hover": { "color": "var(--color-base-content)" } }, '.vc [data-vc="dates"]': { "pointer-events": "none", "display": "grid", "flex-grow": 1, "grid-template-columns": "1fr", "grid-template-rows": "auto", "align-items": "center", "justify-items": "center", "&[data-vc-dates-disabled] [data-vc-date-btn]": { "cursor": "default" } }, '.vc[data-vc-type="multiple"] [data-vc="dates"]': { "flex-grow": 0 }, '.vc [data-vc-dates="row"]': { "display": "grid", "width": "100%", "grid-template-columns": "repeat(7, 1fr)", "align-items": "center", "justify-items": "center" }, ':is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-month="next"]) [data-vc-date-btn], :is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-month="next"])  .vc-date__btn': { "color": "color-mix(in oklab, var(--color-base-content) 40%, transparent)" }, ":is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-disabled]": { "pointer-events": "none", "[data-vc-date-btn], .vc-date__btn": { "pointer-events": "none", "color": "color-mix(in oklab, var(--color-base-content) 30%, transparent)", "opacity": 0.8 } }, ":is(.vc [data-vc-date], .vc  .vc-date):not(:has([data-vc-date-btn]))": { "pointer-events": "none" }, ":is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-hover] [data-vc-date-btn]": { "border-radius": "0" }, ":is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-hover] [data-vc-date-btn], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-hover]  .vc-date__btn": { "background-color": "var(--color-base-200)" }, ':is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-hover][data-vc-date-hover="first"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-hover][data-vc-date-hover="last"]) [data-vc-date-btn], :is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-hover][data-vc-date-hover="first"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-hover][data-vc-date-hover="last"])  .vc-date__btn': { "background-color": "var(--color-base-300)", "&:hover": { "background-color": "var(--color-base-300)" } }, ':is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-hover][data-vc-date-hover="first"] [data-vc-date-btn]': { "border-start-start-radius": "var(--radius-field)", "border-end-start-radius": "var(--radius-field)", "border-start-end-radius": "0", "border-end-end-radius": "0" }, ':is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-hover][data-vc-date-hover="last"] [data-vc-date-btn]': { "border-start-start-radius": "0", "border-end-start-radius": "0", "border-start-end-radius": "var(--radius-field)", "border-end-end-radius": "var(--radius-field)" }, ':is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-hover][data-vc-date-hover="first-and-last"] [data-vc-date-btn]': { "border-radius": "var(--radius-field)" }, ':is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-hover][data-vc-date-selected][data-vc-date-hover="first"] [data-vc-date-btn]': { "border-start-start-radius": "var(--radius-field)", "border-end-start-radius": "var(--radius-field)" }, ':is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-hover][data-vc-date-selected][data-vc-date-hover="last"] [data-vc-date-btn]': { "border-start-end-radius": "var(--radius-field)", "border-end-end-radius": "var(--radius-field)" }, ":is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-hover]:has( + [data-vc-date-disabled]) [data-vc-date-btn]": { "border-start-end-radius": "var(--radius-field)", "border-end-end-radius": "var(--radius-field)" }, ":is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected] [data-vc-date-btn], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected]  .vc-date__btn": { "background-color": "var(--color-base-content)", "color": "var(--color-base-100)", "&:hover": { "background-color": "var(--color-base-content)", "color": "var(--color-base-100)" } }, ":is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected]:has( + [data-vc-date-disabled]) [data-vc-date-btn]": { "border-start-end-radius": "var(--radius-field)", "border-end-end-radius": "var(--radius-field)" }, ':is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected][data-vc-date-selected="first"] [data-vc-date-btn]': { "border-start-start-radius": "var(--radius-field)", "border-end-start-radius": "var(--radius-field)", "border-start-end-radius": "0", "border-end-end-radius": "0" }, ':is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected][data-vc-date-selected="last"] [data-vc-date-btn]': { "border-start-start-radius": "0", "border-end-start-radius": "0", "border-start-end-radius": "var(--radius-field)", "border-end-end-radius": "var(--radius-field)" }, ':is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected][data-vc-date-selected="first-and-last"] [data-vc-date-btn]': { "border-start-start-radius": "var(--radius-field)", "border-start-end-radius": "var(--radius-field)", "border-end-start-radius": "var(--radius-field)", "border-end-end-radius": "var(--radius-field)" }, ':is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected][data-vc-date-selected="middle"] [data-vc-date-btn]': { "border-radius": "0" }, ':is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected][data-vc-date-month="next"]) [data-vc-date-btn], :is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected][data-vc-date-month="next"])  .vc-date__btn': { "background-color": "var(--color-base-300)", "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)", "&:hover": { "background-color": "var(--color-base-300)", "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)" } }, ':is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected][data-vc-date-selected="middle"][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected][data-vc-date-selected="middle"][data-vc-date-month="next"]) [data-vc-date-btn], :is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected][data-vc-date-selected="middle"][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-selected][data-vc-date-selected="middle"][data-vc-date-month="next"])  .vc-date__btn': { "background-color": "var(--color-base-200)", "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)", "&:hover": { "background-color": "var(--color-base-200)", "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)" } }, ":is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-today] [data-vc-date-btn], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-today]  .vc-date__btn": { "background-color": "var(--color-primary)", "color": "var(--color-primary-content)", "font-weight": 700, "&:hover": { "color": "var(--color-primary-content)" } }, ':is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-today][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-today][data-vc-date-month="next"]) [data-vc-date-btn], :is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-today][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-today][data-vc-date-month="next"])  .vc-date__btn': { "color": "color-mix(in oklab, var(--color-base-content) 50%, transparent)" }, ":is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday] [data-vc-date-btn], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday]  .vc-date__btn": { "color": "var(--color-error)", "&:hover": { "background-color": "color-mix(in oklab, var(--color-error) 10%, transparent)" } }, ":is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-hover] [data-vc-date-btn], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-hover]  .vc-date__btn": { "background-color": "color-mix(in oklab, var(--color-error) 10%, transparent)" }, ':is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-hover][data-vc-date-hover="first"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-hover][data-vc-date-hover="last"]) [data-vc-date-btn], :is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-hover][data-vc-date-hover="first"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-hover][data-vc-date-hover="last"])  .vc-date__btn': { "background-color": "color-mix(in oklab, var(--color-error) 20%, transparent)", "&:hover": { "background-color": "color-mix(in oklab, var(--color-error) 20%, transparent)" } }, ":is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-disabled] [data-vc-date-btn], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-disabled]  .vc-date__btn": { "color": "color-mix(in oklab, var(--color-base-content) 30%, transparent)", "opacity": 0.8 }, ":is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-today] [data-vc-date-btn], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-today]  .vc-date__btn": { "background-color": "var(--color-error)", "color": "var(--color-error-content)" }, ":is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-today][data-vc-date-disabled] [data-vc-date-btn], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-today][data-vc-date-disabled]  .vc-date__btn": { "color": "color-mix(in oklab, var(--color-base-content) 30%, transparent)" }, ':is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-today][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-today][data-vc-date-month="next"]) [data-vc-date-btn], :is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-today][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-today][data-vc-date-month="next"])  .vc-date__btn': { "color": "color-mix(in oklab, var(--color-base-content) 40%, transparent)" }, ':is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-month="next"]) [data-vc-date-btn], :is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-month="next"])  .vc-date__btn': { "background-color": "var(--color-base-100)", "color": "color-mix(in oklab, var(--color-base-content) 40%, transparent)", "&:hover": { "background-color": "var(--color-base-200)", "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)" } }, ':is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-hover][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-hover][data-vc-date-month="next"]) [data-vc-date-btn], :is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-hover][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-hover][data-vc-date-month="next"])  .vc-date__btn': { "background-color": "var(--color-base-200)" }, ':is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-disabled][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-disabled][data-vc-date-month="next"]) [data-vc-date-btn], :is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-disabled][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-disabled][data-vc-date-month="next"])  .vc-date__btn': { "color": "color-mix(in oklab, var(--color-base-content) 30%, transparent)", "opacity": 0.8 }, ":is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-selected] [data-vc-date-btn], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-selected]  .vc-date__btn": { "background-color": "var(--color-error)", "color": "var(--color-error-content)", "&:hover": { "background-color": "var(--color-error)", "color": "var(--color-error-content)" } }, ':is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-selected][data-vc-date-selected="middle"] [data-vc-date-btn], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-selected][data-vc-date-selected="middle"]  .vc-date__btn': { "background-color": "color-mix(in oklab, var(--color-error) 75%, transparent)", "color": "var(--color-error-content)", "&:hover": { "background-color": "color-mix(in oklab, var(--color-error) 75%, transparent)", "color": "var(--color-error-content)" } }, ':is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-selected][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-selected][data-vc-date-month="next"]) [data-vc-date-btn], :is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-selected][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-selected][data-vc-date-month="next"])  .vc-date__btn': { "background-color": "var(--color-base-300)", "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)", "&:hover": { "background-color": "var(--color-base-300)", "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)" } }, ':is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-selected][data-vc-date-selected="middle"][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-selected][data-vc-date-selected="middle"][data-vc-date-month="next"]) [data-vc-date-btn], :is(:is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-selected][data-vc-date-selected="middle"][data-vc-date-month="prev"], :is(.vc [data-vc-date], .vc  .vc-date)[data-vc-date-holiday][data-vc-date-selected][data-vc-date-selected="middle"][data-vc-date-month="next"])  .vc-date__btn': { "background-color": "var(--color-base-200)", "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)", "&:hover": { "background-color": "var(--color-base-200)", "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)" } }, ".vc [data-vc-date]": { "pointer-events": "auto", "position": "relative", "display": "flex", "width": "100%", "align-items": "center", "justify-content": "center", "padding-block": "0.125rem", "&[data-vc-date-disabled] + [data-vc-date-selected] [data-vc-date-btn], &[data-vc-date-disabled] + [data-vc-date-hover] [data-vc-date-btn]": { "border-start-start-radius": "var(--radius-field)", "border-end-start-radius": "var(--radius-field)" } }, ".vc [data-vc-date-btn], .vc  .vc-date__btn": { "background-color": "var(--color-base-100)", "color": "var(--color-base-content)", "&:hover": { "background-color": "var(--color-base-200)" } }, ".vc [data-vc-date-btn]": { "display": "flex", "min-height": "1.875rem", "min-width": "1.875rem", "height": "100%", "width": "100%", "cursor": "pointer", "align-items": "center", "justify-content": "center", "border": "0", "border-radius": "var(--radius-field)", "padding": "0", "font-size": "0.75rem", "font-weight": 400, "transition-property": "color, background-color, border-color, opacity, box-shadow, transform", "transition-duration": "75ms" }, ".vc [data-vc-date-btn]:focus-visible + [data-vc-date-popup], .vc  [data-vc-date-btn]:hover + [data-vc-date-popup], .vc  [data-vc-date-popup]:focus-visible, .vc  [data-vc-date-popup]:hover": { "pointer-events": "auto", "opacity": 1 }, ".vc [data-vc-date-popup], .vc  .vc-date__popup": { "background-color": "var(--color-base-100)", "color": "var(--color-base-content)", "box-shadow": "0 3px 15px color-mix(in oklab, var(--color-base-content) 20%, transparent)" }, ".vc [data-vc-date-popup]": { "pointer-events": "none", "position": "absolute", "z-index": 20, "min-width": "5rem", "max-width": "9rem", "transform": "translateX(-50%)", "border-radius": "var(--radius-field)", "padding": "0.25rem 0.5rem", "font-size": "0.75rem", "font-weight": 400, "opacity": 0, "transition-property": "opacity", "transition-duration": "75ms", "&:hover": { "pointer-events": "auto", "opacity": 1 } }, ".vc [data-vc-date-range-tooltip], .vc  .vc-date-range-tooltip": { "background-color": "var(--color-base-200)", "color": "color-mix(in oklab, var(--color-base-content) 70%, transparent)", "box-shadow": "0 1px 4px color-mix(in oklab, var(--color-base-content) 20%, transparent)" }, ".vc [data-vc-date-range-tooltip]": { "pointer-events": "none", "position": "absolute", "z-index": 30, "max-width": "9rem", "transform": "translate(-50%, -100%)", "border-radius": "var(--radius-field)", "padding": "0.25rem 0.5rem", "font-size": "0.75rem", "font-weight": 400, '&[data-vc-date-range-tooltip="hidden"]': { "opacity": 0 }, '&[data-vc-date-range-tooltip="visible"]': { "opacity": 1 } }, '.vc [data-vc="time"], .vc  .vc-time': { "border-color": "var(--color-base-200)" }, '.vc [data-vc="time"]': { "margin-top": "0.75rem", "display": "grid", "grid-template-columns": "auto 1fr", "gap": "0.75rem", "border-style": "solid", "border-width": "var(--border) 0 0", "padding-top": "0.75rem" }, '.vc [data-vc-time="content"]': { "display": "grid", "grid-auto-flow": "column", "align-items": "center" }, ':is(.vc [data-vc-time-input="hour"], .vc  [data-vc-time-input="minute"], .vc  .vc-time__hour, .vc  .vc-time__minute)::after': { "color": "var(--color-base-content)" }, '.vc [data-vc-time-input="hour"]': { "position": "relative", "margin-right": "0.35rem", "width": "1.75rem", "&::after": { "--tw-content": '":"', "content": "var(--tw-content)", "position": "absolute", "inset-inline-end": "-5px", "inset-block-start": "50%", "display": "block", "margin-top": "calc(-50% + 1px)" } }, '.vc [data-vc-time-input="minute"]': { "width": "1.75rem" }, '.vc [data-vc-time-input="hour"] input, .vc  [data-vc-time-input="minute"] input, .vc  .vc-time__hour input, .vc  .vc-time__minute input': { "background-color": "var(--color-base-100)", "color": "var(--color-base-content)", "&:hover, &[data-vc-input-focus]": { "background-color": "var(--color-base-200)" }, "&:focus-visible": { "outline-color": "var(--color-primary)" }, "&[data-vc-input-focus]": { "background-color": "var(--color-base-200)" } }, '.vc [data-vc-time-input="hour"] input, .vc  [data-vc-time-input="minute"] input': { "position": "relative", "box-sizing": "border-box", "margin": "0", "display": "block", "width": "100%", "border": "0", "border-radius": "var(--radius-field)", "padding": "0.125rem", "text-align": "center", "font-size": "1.125rem", "font-weight": 600, "line-height": "1.125rem", "&:disabled": { "cursor": "default", "&:hover": { "background-color": "transparent" } }, "&:focus-visible": { "outline": "1px solid var(--color-primary)" } }, '.vc [data-vc-time="keeping"], .vc  .vc-time__keeping': { "color": "color-mix(in oklab, var(--color-base-content) 70%, transparent)", "&:hover": { "background-color": "var(--color-base-200)", "color": "var(--color-base-content)" }, "&:focus-visible": { "outline-color": "var(--color-primary)" } }, '.vc [data-vc-time="keeping"]': { "margin-top": "0.25rem", "margin-left": "1px", "width": "22px", "cursor": "pointer", "border": "0", "border-radius": "var(--radius-field)", "background-color": "transparent", "padding": "0", "font-size": "0.69rem", "&:disabled": { "cursor": "default", "&:hover": { "background-color": "transparent" } }, "&:focus-visible": { "outline": "1px solid var(--color-primary)" } }, '.vc [data-vc-time="ranges"]': { "display": "grid", "grid-auto-flow": "row" }, ":is(.vc [data-vc-time-range], .vc  .vc-time__range) input": { "background-color": "var(--color-base-100)", "&:focus-visible": { "&::-webkit-slider-thumb, &::-moz-range-thumb": { "border-color": "var(--color-primary)" } }, "&::-webkit-slider-thumb, &::-moz-range-thumb": { "border-color": "var(--color-base-300)", "background-color": "var(--color-base-100)" }, "&::-webkit-slider-runnable-track, &::-moz-range-track": { "background-color": "var(--color-base-300)" } }, ":is(.vc [data-vc-time-range], .vc  .vc-time__range):hover input::-webkit-slider-thumb, :is(.vc [data-vc-time-range], .vc  .vc-time__range):hover input::-moz-range-thumb": { "border-color": "color-mix(in oklab, var(--color-base-content) 40%, transparent)" }, ":is(.vc [data-vc-time-range], .vc  .vc-time__range)::before, :is(.vc [data-vc-time-range], .vc  .vc-time__range)::after": { "background-color": "var(--color-base-300)" }, ".vc [data-vc-time-range]": { "position": "relative", "z-index": 10, "font-size": "0", "&::before": { "inset-inline-start": "0" }, "&::after": { "inset-inline-end": "0" }, "&::before, &::after": { "content": '""', "pointer-events": "none", "position": "absolute", "inset-block-start": "50%", "z-index": 10, "height": "0.5rem", "width": "1px", "transform": "translateY(-50%)" }, "input": { "position": "relative", "margin": "0", "height": "1.25rem", "width": "100%", "cursor": "pointer", "appearance": "none", "outline": "0", "&::-webkit-slider-thumb": { "appearance": "none", "margin-top": "-0.5rem" }, "&::-webkit-slider-thumb, &::-moz-range-thumb": { "position": "relative", "z-index": 20, "box-sizing": "border-box", "height": "1rem", "width": "0.75rem", "cursor": "pointer", "border": "var(--border) solid var(--color-base-300)", "border-radius": "var(--radius-field)", "box-shadow": "none" }, "&::-webkit-slider-runnable-track, &::-moz-range-track": { "box-sizing": "border-box", "margin-top": "1px", "height": "1px", "width": "100%", "cursor": "pointer", "box-shadow": "none" } } } } };

  // vendor/package/components/calendar/index.js
  var calendar_default = ({ addComponents, prefix = "" }) => {
    const prefixedcalendar = addPrefix(object_default32, prefix);
    addComponents({ ...prefixedcalendar });
  };

  // vendor/package/components/divider/object.js
  var object_default33 = { "@layer daisyui.l1.l2.l3": { ".divider": { "display": "flex", "height": "calc(0.25rem * 4)", "flex-direction": "row", "align-items": "center", "align-self": "stretch", "white-space": "nowrap", "margin": "var(--divider-m, 1rem 0)", "--divider-color": "color-mix(in oklab, var(--color-base-content) 10%, transparent)" }, ".divider:before, .divider:after": { "content": '""', "height": "calc(0.25rem * 0.5)", "width": "100%", "flex-grow": 1, "background-color": "var(--divider-color)" }, "@media print": { ".divider:before, .divider:after": { "border": "0.5px solid" } }, ".divider:not(:empty)": { "gap": "calc(0.25rem * 4)" } }, "@layer daisyui.l1.l2": { ".divider-horizontal": { "--divider-m": "0 1rem" }, ".divider-horizontal.divider": { "height": "auto", "width": "calc(0.25rem * 4)", "flex-direction": "column", "&:before": { "height": "100%", "width": "calc(0.25rem * 0.5)" }, "&:after": { "height": "100%", "width": "calc(0.25rem * 0.5)" } }, ".divider-vertical": { "--divider-m": "1rem 0" }, ".divider-vertical.divider": { "height": "calc(0.25rem * 4)", "width": "auto", "flex-direction": "row", "&:before": { "height": "calc(0.25rem * 0.5)", "width": "100%" }, "&:after": { "height": "calc(0.25rem * 0.5)", "width": "100%" } }, ".divider-neutral:before, .divider-neutral:after": { "background-color": "var(--color-neutral)" }, ".divider-primary:before, .divider-primary:after": { "background-color": "var(--color-primary)" }, ".divider-secondary:before, .divider-secondary:after": { "background-color": "var(--color-secondary)" }, ".divider-accent:before, .divider-accent:after": { "background-color": "var(--color-accent)" }, ".divider-success:before, .divider-success:after": { "background-color": "var(--color-success)" }, ".divider-warning:before, .divider-warning:after": { "background-color": "var(--color-warning)" }, ".divider-info:before, .divider-info:after": { "background-color": "var(--color-info)" }, ".divider-error:before, .divider-error:after": { "background-color": "var(--color-error)" }, ".divider-start:before": { "display": "none" }, ".divider-end:after": { "display": "none" } } };

  // vendor/package/components/divider/index.js
  var divider_default = ({ addComponents, prefix = "" }) => {
    const prefixeddivider = addPrefix(object_default33, prefix);
    addComponents({ ...prefixeddivider });
  };

  // vendor/package/components/modal/object.js
  var object_default34 = { "@layer daisyui.l1.l2.l3": [{ ".modal": { "pointer-events": "none", "visibility": "hidden", "position": "fixed", "inset": "0px", "margin": "0px", "display": "grid", "height": "100%", "max-height": "none", "width": "100%", "max-width": "none", "align-items": "center", "justify-items": "center", "background-color": "transparent", "padding": "0px", "color": "inherit", "transition": "overlay 0.3s allow-discrete, visibility 0.3s allow-discrete, background-color 0.3s ease-out, opacity 0.1s ease-out", "overflow": "clip", "overscroll-behavior": "contain", "z-index": 999, "scrollbar-gutter": "auto" }, ".modal::backdrop": { "display": "none" }, ".modal[popover]": { "inset": "0", "margin": "0", "border": "0", "padding": "0", "background": "transparent", "color": "inherit", "max-width": "none", "max-height": "none", "&::backdrop": { "background-color": "oklch(0% 0 0/ 0.4)", "transition": "background-color 0.3s ease-out" } } }, { ".modal-action": { "margin-top": "calc(0.25rem * 6)", "display": "flex", "justify-content": "flex-end", "gap": "calc(0.25rem * 2)" }, ".modal-toggle": { "position": "fixed", "height": "0px", "width": "0px", "appearance": "none", "opacity": "0%" }, ".modal-backdrop": { "grid-column-start": "1", "grid-row-start": "1", "display": "grid", "align-self": "stretch", "justify-self": "stretch", "color": "transparent", "z-index": -1 }, ".modal-backdrop button": { "cursor": "pointer" }, ".modal-box": { "grid-column-start": "1", "grid-row-start": "1", "max-height": "100vh", "width": "calc(11 / 12 * 100%)", "max-width": "32rem", "background-color": "var(--color-base-100)", "padding": "calc(0.25rem * 6)", "transition": "translate 0.3s ease-out, scale 0.3s ease-out, opacity 0.2s ease-out 0.05s, box-shadow 0.3s ease-out", "border-top-left-radius": "var(--modal-tl, var(--radius-box))", "border-top-right-radius": "var(--modal-tr, var(--radius-box))", "border-bottom-left-radius": "var(--modal-bl, var(--radius-box))", "border-bottom-right-radius": "var(--modal-br, var(--radius-box))", "scale": "95%", "opacity": 0, "box-shadow": "oklch(0% 0 0/ 0.25) 0px 25px 50px -12px", "overflow-y": "auto", "overscroll-behavior": "contain" } }], "@layer daisyui.l1.l2": [{ ".modal.modal-open, .modal[open], .modal:popover-open, .modal:target, .modal-toggle:checked + .modal": { "pointer-events": "auto", "visibility": "visible", "opacity": "100%", "transition": "visibility 0s allow-discrete, background-color 0.3s ease-out, opacity 0.1s ease-out", "background-color": "oklch(0% 0 0/ 0.4)", "> .modal-box": { "translate": "0 0", "scale": "1", "opacity": 1 }, ":root:has(&)": { "--page-scroll-lock": " " } }, "@starting-style": { ".modal.modal-open, .modal[open], .modal:popover-open, .modal:target, .modal-toggle:checked + .modal": { "opacity": "0%" } } }, { ".modal-top": { "place-items": "start" }, ".modal-top > .modal-box": { "height": "auto", "width": "100%", "max-width": "none", "max-height": "calc(100vh - 5em)", "translate": "0 -100%", "scale": "1", "--modal-tl": "0", "--modal-tr": "0", "--modal-bl": "var(--radius-box)", "--modal-br": "var(--radius-box)" }, ".modal-middle": { "place-items": "center" }, ".modal-middle > .modal-box": { "height": "auto", "width": "calc(11 / 12 * 100%)", "max-width": "32rem", "max-height": "calc(100vh - 5em)", "translate": "0 2%", "scale": "98%", "--modal-tl": "var(--radius-box)", "--modal-tr": "var(--radius-box)", "--modal-bl": "var(--radius-box)", "--modal-br": "var(--radius-box)" }, ".modal-bottom": { "place-items": "end" }, ".modal-bottom > .modal-box": { "height": "auto", "width": "100%", "max-width": "none", "max-height": "calc(100vh - 5em)", "translate": "0 100%", "scale": "1", "--modal-tl": "var(--radius-box)", "--modal-tr": "var(--radius-box)", "--modal-bl": "0", "--modal-br": "0" }, ".modal-start": { "place-items": "start" }, ".modal-start > .modal-box": { "height": "100vh", "max-height": "none", "width": "auto", "max-width": "none", "translate": "-100% 0", "scale": "1", "--modal-tl": "0", "--modal-tr": "var(--radius-box)", "--modal-bl": "0", "--modal-br": "var(--radius-box)", '[dir="rtl"] &': { "translate": "100% 0", "--modal-tl": "var(--radius-box)", "--modal-tr": "0", "--modal-bl": "var(--radius-box)", "--modal-br": "0" } }, ".modal-end": { "place-items": "end" }, ".modal-end > .modal-box": { "height": "100vh", "max-height": "none", "width": "auto", "max-width": "none", "translate": "100% 0", "scale": "1", "--modal-tl": "var(--radius-box)", "--modal-tr": "0", "--modal-bl": "var(--radius-box)", "--modal-br": "0", '[dir="rtl"] &': { "translate": "-100% 0", "--modal-tl": "0", "--modal-tr": "var(--radius-box)", "--modal-bl": "0", "--modal-br": "var(--radius-box)" } } }] };

  // vendor/package/components/modal/index.js
  var modal_default = ({ addComponents, prefix = "" }) => {
    const prefixedmodal = addPrefix(object_default34, prefix);
    addComponents({ ...prefixedmodal });
  };

  // vendor/package/components/steps/object.js
  var object_default35 = { "@layer daisyui.l1.l2.l3": { ".steps": { "display": "inline-grid", "grid-auto-flow": "column", "overflow": "hidden", "overflow-x": "auto", "counter-reset": "step", "grid-auto-columns": "1fr" }, ".steps .step": { "display": "grid", "grid-template-columns": ["repeat(1, minmax(0, 1fr))", "auto"], "grid-template-rows": ["repeat(2, minmax(0, 1fr))", "40px 1fr"], "place-items": "center", "text-align": "center", "min-width": "4rem", "--step-bg": "var(--color-base-300)", "--step-fg": "var(--color-base-content)", "&:before": { "top": "0px", "grid-column-start": "1", "grid-row-start": "1", "height": "calc(0.25rem * 2)", "width": "100%", "border": "1px solid", "color": "var(--step-bg)", "background-color": "var(--step-bg)", "content": '""', "margin-inline-start": "-100%" }, "> .step-icon, &:not(:has(.step-icon)):after": { "--tw-content": "counter(step)", "content": "var(--tw-content)", "counter-increment": "step", "z-index": 1, "color": "var(--step-fg)", "background-color": "var(--step-bg)", "border": "1px solid var(--step-bg)", "position": "relative", "grid-column-start": "1", "grid-row-start": "1", "display": "grid", "height": "calc(0.25rem * 8)", "width": "calc(0.25rem * 8)", "place-items": "center", "place-self": "center", "border-radius": "calc(infinity * 1px)" }, "&:first-child:before": { "--tw-content": "none", "content": "var(--tw-content)" }, "&[data-content]:after": { "--tw-content": "attr(data-content)", "content": "var(--tw-content)" } } }, "@layer daisyui.l1.l2": { ".steps .step-neutral + .step-neutral:before, .steps .step-neutral:after, .steps .step-neutral  > .step-icon": { "--step-bg": "var(--color-neutral)", "--step-fg": "var(--color-neutral-content)" }, ".steps .step-primary + .step-primary:before, .steps .step-primary:after, .steps .step-primary  > .step-icon": { "--step-bg": "var(--color-primary)", "--step-fg": "var(--color-primary-content)" }, ".steps .step-secondary + .step-secondary:before, .steps .step-secondary:after, .steps .step-secondary  > .step-icon": { "--step-bg": "var(--color-secondary)", "--step-fg": "var(--color-secondary-content)" }, ".steps .step-accent + .step-accent:before, .steps .step-accent:after, .steps .step-accent  > .step-icon": { "--step-bg": "var(--color-accent)", "--step-fg": "var(--color-accent-content)" }, ".steps .step-info + .step-info:before, .steps .step-info:after, .steps .step-info  > .step-icon": { "--step-bg": "var(--color-info)", "--step-fg": "var(--color-info-content)" }, ".steps .step-success + .step-success:before, .steps .step-success:after, .steps .step-success  > .step-icon": { "--step-bg": "var(--color-success)", "--step-fg": "var(--color-success-content)" }, ".steps .step-warning + .step-warning:before, .steps .step-warning:after, .steps .step-warning  > .step-icon": { "--step-bg": "var(--color-warning)", "--step-fg": "var(--color-warning-content)" }, ".steps .step-error + .step-error:before, .steps .step-error:after, .steps .step-error  > .step-icon": { "--step-bg": "var(--color-error)", "--step-fg": "var(--color-error-content)" }, ".steps-horizontal": { "grid-auto-columns": "1fr", "display": "inline-grid", "grid-auto-flow": "column", "overflow": "hidden", "overflow-x": "auto" }, ".steps-horizontal .step": { "display": "grid", "grid-template-columns": ["repeat(1, minmax(0, 1fr))", "auto"], "grid-template-rows": ["repeat(2, minmax(0, 1fr))", "40px 1fr"], "place-items": "center", "text-align": "center", "min-width": "4rem", "&:before": { "height": "calc(0.25rem * 2)", "width": "100%", "translate": "0", "margin-inline-start": "-100%" }, '[dir="rtl"] &:before': { "translate": "0" } }, ".steps-vertical": { "grid-auto-rows": "1fr", "grid-auto-flow": "row" }, ".steps-vertical .step": { "display": "grid", "grid-template-columns": ["repeat(2, minmax(0, 1fr))", "40px 1fr"], "grid-template-rows": ["repeat(1, minmax(0, 1fr))", "auto"], "gap": "0.5rem", "min-height": "4rem", "justify-items": "start", "&:before": { "height": "100%", "width": "calc(0.25rem * 2)", "translate": "-50% -50%", "margin-inline-start": "50%" }, '[dir="rtl"] &:before': { "translate": "50% -50%" } } } };

  // vendor/package/components/steps/index.js
  var steps_default = ({ addComponents, prefix = "" }) => {
    const prefixedsteps = addPrefix(object_default35, prefix);
    addComponents({ ...prefixedsteps });
  };

  // vendor/package/components/list/object.js
  var object_default36 = { "@layer daisyui.l1.l2.l3": { ".list": { "display": "flex", "flex-direction": "column", "font-size": "0.875rem" }, ".list .list-row": { "--list-grid-cols": "minmax(0, auto) 1fr", "position": "relative", "display": "grid", "grid-auto-flow": "column", "gap": "calc(0.25rem * 4)", "border-radius": "var(--radius-box)", "padding": "calc(0.25rem * 4)", "word-break": "break-word", "grid-template-columns": "var(--list-grid-cols)" }, ":is(.list > :not(:last-child).list-row, .list > :not(:last-child)  .list-row):after": { "content": '""', "border-bottom": "var(--border) solid", "inset-inline": "var(--radius-box)", "position": "absolute", "bottom": "0px", "border-color": "color-mix(in oklab, var(--color-base-content) 5%, transparent)" } }, "@layer daisyui.l1.l2": { ".list .list-row:has( > .list-col-grow:nth-child(1))": { "--list-grid-cols": "1fr" }, ".list .list-row:has( > .list-col-grow:nth-child(2))": { "--list-grid-cols": "minmax(0, auto) 1fr" }, ".list .list-row:has( > .list-col-grow:nth-child(3))": { "--list-grid-cols": "minmax(0, auto) minmax(0, auto) 1fr" }, ".list .list-row:has( > .list-col-grow:nth-child(4))": { "--list-grid-cols": "minmax(0, auto) minmax(0, auto) minmax(0, auto) 1fr" }, ".list .list-row:has( > .list-col-grow:nth-child(5))": { "--list-grid-cols": "minmax(0, auto) minmax(0, auto) minmax(0, auto) minmax(0, auto) 1fr" }, ".list .list-row:has( > .list-col-grow:nth-child(6))": { "--list-grid-cols": "minmax(0, auto) minmax(0, auto) minmax(0, auto) minmax(0, auto)\n          minmax(0, auto) 1fr" }, ".list .list-row > *": { "grid-row-start": "1" } }, "@layer daisyui.l1": { ".list-col-wrap": { "grid-row-start": "2" } } };

  // vendor/package/components/list/index.js
  var list_default = ({ addComponents, prefix = "" }) => {
    const prefixedlist = addPrefix(object_default36, prefix);
    addComponents({ ...prefixedlist });
  };

  // vendor/package/components/breadcrumbs/object.js
  var object_default37 = { "@layer daisyui.l1.l2.l3": { ".breadcrumbs": { "margin-inline-start": "calc(0.25rem * -1)", "max-width": "100%", "overflow-x": "auto", "padding-block": "calc(0.25rem * 2)" }, ".breadcrumbs > menu, .breadcrumbs  > ul, .breadcrumbs  > ol": { "display": "flex", "min-height": "min-content", "align-items": "center", "padding-inline-start": "0.25rem", "white-space": "nowrap", "> li": { "display": "flex", "align-items": "center", "> *": { "display": "flex", "cursor": "pointer", "align-items": "center", "gap": "calc(0.25rem * 2)", "&:hover": { "@media (hover: hover)": { "text-decoration-line": "underline" } }, "&:focus": { "--tw-outline-style": "none", "outline-style": "none", "@media (forced-colors: active)": { "outline": "2px solid transparent", "outline-offset": "2px" } }, "&:focus-visible": { "outline": "2px solid currentColor", "outline-offset": "2px" } }, "& + *:before": { "content": '""', "margin-inline-start": "calc(0.25rem * 2)", "margin-inline-end": "calc(0.25rem * 3)", "display": "block", "height": "calc(0.25rem * 1.5)", "width": "calc(0.25rem * 1.5)", "opacity": "40%", "rotate": "45deg", "border-top": "1px solid", "border-right": "1px solid", "background-color": "#0000" }, '[dir="rtl"] & + *:before': { "rotate": "-135deg" } } } } };

  // vendor/package/components/breadcrumbs/index.js
  var breadcrumbs_default = ({ addComponents, prefix = "" }) => {
    const prefixedbreadcrumbs = addPrefix(object_default37, prefix);
    addComponents({ ...prefixedbreadcrumbs });
  };

  // vendor/package/components/chat/object.js
  var object_default38 = { "@layer daisyui.l1.l2.l3": [{ ".chat": { "display": "grid", "grid-auto-rows": "min-content", "column-gap": "calc(0.25rem * 3)", "padding-block": "0.25rem", "--mask-chat": `url("data:image/svg+xml,%3csvg width='13' height='13' xmlns='http://www.w3.org/2000/svg'%3e%3cpath fill='black' d='M0 11.5004C0 13.0004 2 13.0004 2 13.0004H12H13V0.00036329L12.5 0C12.5 0 11.977 2.09572 11.8581 2.50033C11.6075 3.35237 10.9149 4.22374 9 5.50036C6 7.50036 0 10.0004 0 11.5004Z'/%3e%3c/svg%3e")` }, ".chat-bubble": { "position": "relative", "display": "block", "width": "fit-content", "border-radius": "var(--radius-field)", "background-color": "var(--color-base-300)", "padding-inline": "calc(0.25rem * 4)", "padding-block": "calc(0.25rem * 2)", "color": "var(--color-base-content)", "grid-row-end": "3", "min-height": "2rem", "min-width": "2.5rem", "max-width": "90%" }, ".chat-bubble:before": { "position": "absolute", "bottom": "0px", "height": "calc(0.25rem * 3)", "width": "calc(0.25rem * 3)", "background-color": "inherit", "content": '""', "mask-repeat": "no-repeat", "mask-image": "var(--mask-chat)", "mask-position": "0px -1px", "mask-size": "0.8125rem" } }, { ".chat-image": { "grid-row": "span 2 / span 2", "align-self": "flex-end" }, ".chat-header": { "grid-row-start": "1", "display": "flex", "gap": "0.25rem", "font-size": "0.6875rem" }, ".chat-footer": { "grid-row-start": "3", "display": "flex", "gap": "0.25rem", "font-size": "0.6875rem" } }], "@layer daisyui.l1.l2": [{ ".chat-bubble-primary": { "background-color": "var(--color-primary)", "color": "var(--color-primary-content)" }, ".chat-bubble-secondary": { "background-color": "var(--color-secondary)", "color": "var(--color-secondary-content)" }, ".chat-bubble-accent": { "background-color": "var(--color-accent)", "color": "var(--color-accent-content)" }, ".chat-bubble-neutral": { "background-color": "var(--color-neutral)", "color": "var(--color-neutral-content)" }, ".chat-bubble-info": { "background-color": "var(--color-info)", "color": "var(--color-info-content)" }, ".chat-bubble-success": { "background-color": "var(--color-success)", "color": "var(--color-success-content)" }, ".chat-bubble-warning": { "background-color": "var(--color-warning)", "color": "var(--color-warning-content)" }, ".chat-bubble-error": { "background-color": "var(--color-error)", "color": "var(--color-error-content)" } }, { ".chat-start": { "place-items": "start", "grid-template-columns": "auto 1fr" }, ".chat-start .chat-header": { "grid-column-start": "2" }, ".chat-start .chat-footer": { "grid-column-start": "2" }, ".chat-start .chat-image": { "grid-column-start": "1" }, ".chat-start .chat-bubble": { "grid-column-start": "2", "border-end-start-radius": "0", "&:before": { "transform": "rotateY(0deg)", "inset-inline-start": "-0.75rem" }, '[dir="rtl"] &:before': { "transform": "rotateY(180deg)" } }, ".chat-end": { "place-items": "end", "grid-template-columns": "1fr auto" }, ".chat-end .chat-header": { "grid-column-start": "1" }, ".chat-end .chat-footer": { "grid-column-start": "1" }, ".chat-end .chat-image": { "grid-column-start": "2" }, ".chat-end .chat-bubble": { "grid-column-start": "1", "border-end-end-radius": "0", "&:before": { "transform": "rotateY(180deg)", "inset-inline-start": "100%" }, '[dir="rtl"] &:before': { "transform": "rotateY(0deg)" } } }] };

  // vendor/package/components/chat/index.js
  var chat_default = ({ addComponents, prefix = "" }) => {
    const prefixedchat = addPrefix(object_default38, prefix);
    addComponents({ ...prefixedchat });
  };

  // vendor/package/components/radialprogress/object.js
  var object_default39 = { "@layer daisyui.l1.l2.l3": { ".radial-progress": { "position": "relative", "display": "inline-grid", "height": "var(--size)", "width": "var(--size)", "flex-shrink": 0, "place-content": "center", "border-radius": "calc(infinity * 1px)", "background-color": "transparent", "vertical-align": "middle", "box-sizing": "content-box", "--value": "0", "--size": "5rem", "--thickness": "calc(var(--size) / 10)", "--radialprogress": "calc(var(--value) * 1%)", "transition": "--radialprogress 0.3s linear" }, ".radial-progress:before": { "position": "absolute", "inset": "0px", "border-radius": "calc(infinity * 1px)", "content": '""', "background": "radial-gradient(farthest-side, currentColor 98%, #0000) top/var(--thickness) var(--thickness) no-repeat, conic-gradient(currentColor var(--radialprogress), #0000 0)", "webkit-mask": "radial-gradient( farthest-side, #0000 calc(100% - var(--thickness)), #000 calc(100% + 0.5px - var(--thickness)) )", "mask": "radial-gradient( farthest-side, #0000 calc(100% - var(--thickness)), #000 calc(100% + 0.5px - var(--thickness)) )" }, ".radial-progress:after": { "position": "absolute", "border-radius": "calc(infinity * 1px)", "background-color": "currentcolor", "transition": "transform 0.3s linear", "content": '""', "inset": "calc(50% - var(--thickness) / 2)", "transform": "rotate(calc(var(--value) * 3.6deg - 90deg)) translate(calc(var(--size) / 2 - 50%))" } } };

  // vendor/package/components/radialprogress/index.js
  var radialprogress_default = ({ addComponents, prefix = "" }) => {
    const prefixedradialprogress = addPrefix(object_default39, prefix);
    addComponents({ ...prefixedradialprogress });
  };

  // vendor/package/components/aura/object.js
  var object_default40 = { "@layer daisyui.l1.l2.l3": { ".aura": { "position": "relative", "display": "inline-block", "--aura-padding": "0.125rem", "padding": "var(--aura-padding)", "border-radius": "calc(var(--aura-padding) + var(--aura-radius, var(--radius-box)))", "animation": "aura var(--tw-duration, 6s) linear infinite", "background-image": "conic-gradient(from var(--aura-angle), transparent 225deg, currentColor)" }, "@media (prefers-reduced-motion: reduce)": { ".aura": { "animation-duration": "calc(var(--tw-duration, 6s) * 4)" } }, ".aura:has( > .card,  > .alert)": { "--aura-radius": "var(--radius-box)" }, ".aura:has( > .btn,  > .input,  > .select)": { "--aura-radius": "var(--radius-field)" }, ".aura:has( > .checkbox,  > .toggle,  > .badge)": { "--aura-radius": "var(--radius-selector)" }, ".aura:before, .aura:after": { "animation": "inherit", "background-color": "inherit", "background-image": "inherit", "border-radius": "inherit", "position": "absolute", "top": "calc(1 / 2 * 100%)", "left": "calc(1 / 2 * 100%)", "z-index": 0, "display": "block", "opacity": "70%", "filter": "blur(0.25rem)", "translate": "-50% -50%", "width": "100%", "height": "100%", "content": '""' }, ".aura:after": { "opacity": "30%", "filter": "blur(1rem)" }, ".aura > *": { "position": "relative", "z-index": 1 } }, "@layer daisyui.l1.l2": { ".aura-rainbow": { "background": "conic-gradient( from var(--aura-angle) in oklch longer hue, transparent 10%, oklch(80% 0.15 0deg), oklch(80% 0.15 360deg), transparent 90% )" }, ".aura-holo": { "background-image": "repeating-conic-gradient( from var(--aura-angle), oklch(0.82 0.17 327), oklch(0.75 0.12 274), oklch(0.82 0.11 191), oklch(0.91 0.11 105), oklch(0.88 0.08 68), oklch(0.82 0.17 327) 10% )", "animation": "aura var(--tw-duration, 20s) linear infinite" }, "@media (prefers-reduced-motion: reduce)": { ".aura-holo": { "animation-duration": "calc(var(--tw-duration, 20s) * 4)" } }, ".aura-dual": { "background-image": "repeating-conic-gradient( from var(--aura-angle), transparent 0%, transparent 40%, currentColor 50% )" }, ".aura-silver": { "background-image": "repeating-conic-gradient( from var(--aura-angle), oklch(0.3 0 0), oklch(0.9 0 0), oklch(0.6 0 0), oklch(0.9 0 0), oklch(0.5 0 0), oklch(0.3 0 0) 50% )" }, ".aura-gold": { "background-image": "repeating-conic-gradient( from var(--aura-angle), oklch(0.6598 0.1863 72.37), oklch(0.9635 0.0768 102.94), oklch(0.7157 0.1691 82.23), oklch(0.9602 0.0792 103.13), oklch(0.6066 0.1181 76.17), oklch(0.6598 0.1863 72.37) 50% )" }, ".aura-glow": { "animation": "none", "background-image": "radial-gradient(closest-corner at center, currentColor 0%, transparent 90%)" }, ".aura-glow:before": { "animation": "aura-glow var(--tw-duration, 6s) ease-out infinite", "@media (prefers-reduced-motion: reduce)": { "animation-duration": "calc(var(--tw-duration, 6s) * 4)" } }, ".aura-glow:after": { "animation": "aura-glow-after var(--tw-duration, 6s) ease-out infinite", "@media (prefers-reduced-motion: reduce)": { "animation-duration": "calc(var(--tw-duration, 6s) * 4)" } }, ".aura-xs": { "--aura-padding": "0rem" }, ".aura-sm": { "--aura-padding": "0.0625rem" }, ".aura-md": { "--aura-padding": "0.125rem" }, ".aura-lg": { "--aura-padding": "0.15625rem" }, ".aura-xl": { "--aura-padding": "0.25rem" } }, "@keyframes aura": { "to": { "--aura-angle": "360deg", "transform": "translateZ(1px)" } }, "@keyframes aura-glow": { "20%, 80%": { "opacity": 0.7, "filter": "blur(0.25rem)" }, "50%": { "opacity": 1, "filter": "blur(0.75rem)" } }, "@keyframes aura-glow-after": { "20%, 80%": { "opacity": 0.3, "filter": "blur(1rem)" }, "50%": { "opacity": 0.6, "filter": "blur(1.5rem)" } } };

  // vendor/package/components/aura/index.js
  var aura_default = ({ addComponents, prefix = "" }) => {
    const prefixedaura = addPrefix(object_default40, prefix);
    addComponents({ ...prefixedaura });
  };

  // vendor/package/components/range/object.js
  var object_default41 = { "@layer daisyui.l1.l2.l3": { ".range": { "appearance": "none", "webkit-appearance": "none", "--range-thumb": "var(--color-base-100)", "--range-thumb-size": "calc(var(--size-selector, 0.25rem) * 6)", "--range-progress": "currentColor", "--range-fill": "1", "--range-p": "0.25rem", "--range-bg": "color-mix(in oklab, currentColor 10%, #0000)", "--range-fill-x": "calc(\n      (var(--range-dir, 1) * -100cqw) - (var(--range-dir, 1) * var(--range-thumb-size) / 2)\n    )", "--range-fill-y": "0", "--range-fill-spread": "calc(100cqw * var(--range-fill))", "cursor": "pointer", "overflow": "hidden", "background-color": "transparent", "vertical-align": "middle", "width": "clamp(3rem, 20rem, 100%)", "--radius-selector-max": "calc(\n      var(--radius-selector) + var(--radius-selector) + var(--radius-selector)\n    )", "border-radius": "calc(var(--radius-selector) + min(var(--range-p), var(--radius-selector-max)))", "border": "none", "height": "var(--range-thumb-size)" }, '[dir="rtl"] .range': { "--range-dir": "-1" }, ".range:focus": { "outline": "none" }, ".range:focus-visible": { "outline": "2px solid", "outline-offset": "2px" }, ".range::-webkit-slider-runnable-track": { "width": "100%", "background-color": "var(--range-bg)", "border-radius": "var(--radius-selector)", "height": "calc(var(--range-thumb-size) * 0.5)" }, "@media (forced-colors: active)": [{ ".range::-webkit-slider-runnable-track": { "border": "1px solid" } }, { ".range::-moz-range-track": { "border": "1px solid" } }], ".range::-webkit-slider-thumb": { "position": "relative", "box-sizing": "border-box", "border-radius": "calc(var(--radius-selector) + min(var(--range-p), var(--radius-selector-max)))", "background-color": "var(--range-thumb)", "height": "var(--range-thumb-size)", "width": "var(--range-thumb-size)", "border": "var(--range-p) solid", "appearance": "none", "webkit-appearance": "none", "inset-block-start": "50%", "color": "var(--range-progress)", "transform": "translateY(-50%)", "box-shadow": "0 -1px oklch(0% 0 0 / calc(var(--depth) * 0.1)) inset, 0 8px 0 -4px oklch(100% 0 0 / calc(var(--depth) * 0.1)) inset, 0 1px color-mix(in oklab, currentColor calc(var(--depth) * 10%), #0000), 0 0 0 2rem var(--range-thumb) inset, var(--range-fill-x) var(--range-fill-y) 0 var(--range-fill-spread)" }, ".range::-moz-range-track": { "width": "100%", "background-color": "var(--range-bg)", "border-radius": "var(--radius-selector)", "height": "calc(var(--range-thumb-size) * 0.5)" }, ".range::-moz-range-thumb": { "position": "relative", "box-sizing": "border-box", "border-radius": "calc(var(--radius-selector) + min(var(--range-p), var(--radius-selector-max)))", "background-color": "currentColor", "height": "var(--range-thumb-size)", "width": "var(--range-thumb-size)", "border": "var(--range-p) solid", "color": "var(--range-progress)", "box-shadow": "0 -1px oklch(0% 0 0 / calc(var(--depth) * 0.1)) inset, 0 8px 0 -4px oklch(100% 0 0 / calc(var(--depth) * 0.1)) inset, 0 1px color-mix(in oklab, currentColor calc(var(--depth) * 10%), #0000), 0 0 0 2rem var(--range-thumb) inset, var(--range-fill-x) var(--range-fill-y) 0 var(--range-fill-spread)" }, ".range:disabled": { "cursor": "not-allowed", "opacity": "30%" } }, "@layer daisyui.l1.l2": { ".range-primary": { "color": "var(--color-primary)", "--range-thumb": "var(--color-primary-content)" }, ".range-secondary": { "color": "var(--color-secondary)", "--range-thumb": "var(--color-secondary-content)" }, ".range-accent": { "color": "var(--color-accent)", "--range-thumb": "var(--color-accent-content)" }, ".range-neutral": { "color": "var(--color-neutral)", "--range-thumb": "var(--color-neutral-content)" }, ".range-success": { "color": "var(--color-success)", "--range-thumb": "var(--color-success-content)" }, ".range-warning": { "color": "var(--color-warning)", "--range-thumb": "var(--color-warning-content)" }, ".range-info": { "color": "var(--color-info)", "--range-thumb": "var(--color-info-content)" }, ".range-error": { "color": "var(--color-error)", "--range-thumb": "var(--color-error-content)" }, ".range-xs": { "--range-thumb-size": "calc(var(--size-selector, 0.25rem) * 4)" }, ".range-sm": { "--range-thumb-size": "calc(var(--size-selector, 0.25rem) * 5)" }, ".range-md": { "--range-thumb-size": "calc(var(--size-selector, 0.25rem) * 6)" }, ".range-lg": { "--range-thumb-size": "calc(var(--size-selector, 0.25rem) * 7)" }, ".range-xl": { "--range-thumb-size": "calc(var(--size-selector, 0.25rem) * 8)" }, ".range-vertical": { "writing-mode": "vertical-lr", "direction": "rtl", "width": "var(--range-thumb-size)", "height": "clamp(3rem, 20rem, 100%)", "--range-fill-x": "0", "--range-fill-y": "calc(100cqh + var(--range-thumb-size) / 2)", "--range-fill-spread": "calc(100cqh * var(--range-fill))" }, ".range-vertical::-webkit-slider-runnable-track": { "height": "100%", "width": "calc(var(--range-thumb-size) * 0.5)" }, ".range-vertical::-webkit-slider-thumb": { "transform": "translateX(-50%)" }, ".range-vertical::-moz-range-track": { "height": "100%", "width": "calc(var(--range-thumb-size) * 0.5)" } } };

  // vendor/package/components/range/index.js
  var range_default = ({ addComponents, prefix = "" }) => {
    const prefixedrange = addPrefix(object_default41, prefix);
    addComponents({ ...prefixedrange });
  };

  // vendor/package/components/stack/object.js
  var object_default42 = { "@layer daisyui.l1.l2.l3": { ".stack": { "display": "inline-grid", "grid-template-columns": "3px 4px 1fr 4px 3px", "grid-template-rows": "3px 4px 1fr 4px 3px" }, ".stack > *": { "height": "100%", "width": "100%", "&:nth-child(n + 2)": { "width": "100%", "opacity": "70%" }, "&:nth-child(2)": { "z-index": 2, "opacity": "90%" }, "&:nth-child(1)": { "z-index": 3, "width": "100%" } } }, "@layer daisyui.l1.l2": { ":is(:is(.stack), .stack.stack-bottom) > *": { "grid-column": "3 / 4", "grid-row": "3 / 6", "&:nth-child(2)": { "grid-column": "2 / 5", "grid-row": "2 / 5" }, "&:nth-child(1)": { "grid-column": "1 / 6", "grid-row": "1 / 4" } }, ".stack.stack-top > *": { "grid-column": "3 / 4", "grid-row": "1 / 4", "&:nth-child(2)": { "grid-column": "2 / 5", "grid-row": "2 / 5" }, "&:nth-child(1)": { "grid-column": "1 / 6", "grid-row": "3 / 6" } }, ".stack.stack-start > *": { "grid-column": "1 / 4", "grid-row": "3 / 4", "&:nth-child(2)": { "grid-column": "2 / 5", "grid-row": "2 / 5" }, "&:nth-child(1)": { "grid-column": "3 / 6", "grid-row": "1 / 6" } }, ".stack.stack-end > *": { "grid-column": "3 / 6", "grid-row": "3 / 4", "&:nth-child(2)": { "grid-column": "2 / 5", "grid-row": "2 / 5" }, "&:nth-child(1)": { "grid-column": "1 / 4", "grid-row": "1 / 6" } } } };

  // vendor/package/components/stack/index.js
  var stack_default = ({ addComponents, prefix = "" }) => {
    const prefixedstack = addPrefix(object_default42, prefix);
    addComponents({ ...prefixedstack });
  };

  // vendor/package/components/fileinput/object.js
  var object_default43 = { "@layer daisyui.l1.l2.l3": { ".file-input": { "border": "var(--border) solid #0000", "display": "inline-flex", "cursor": "pointer", "appearance": "none", "align-items": "center", "background-color": "var(--color-base-100)", "vertical-align": "middle", "webkit-user-select": "none", "user-select": "none", "width": "clamp(3rem, 20rem, 100%)", "height": "var(--size)", "padding-inline-end": "0.75rem", "font-size": "0.875rem", "line-height": 2, "border-start-start-radius": "var(--join-ss, var(--radius-field))", "border-start-end-radius": "var(--join-se, var(--radius-field))", "border-end-start-radius": "var(--join-es, var(--radius-field))", "border-end-end-radius": "var(--join-ee, var(--radius-field))", "border-color": "var(--input-color)", "box-shadow": "0 1px color-mix(in oklab, var(--input-color) calc(var(--depth) * 10%), #0000) inset, 0 -1px oklch(100% 0 0 / calc(var(--depth) * 0.1)) inset", "--size": "calc(var(--size-field, 0.25rem) * 10)", "--input-color": "color-mix(in oklab, var(--color-base-content) 20%, #0000)" }, ".file-input::file-selector-button": { "margin-inline-end": "calc(0.25rem * 4)", "cursor": "pointer", "padding-inline": "calc(0.25rem * 4)", "webkit-user-select": "none", "user-select": "none", "height": "calc(100% + var(--border) * 2)", "margin-block": "calc(var(--border) * -1)", "margin-inline-start": "calc(var(--border) * -1)", "font-size": "0.875rem", "color": "var(--btn-fg)", "border-width": "var(--border)", "border-style": "solid", "border-color": "var(--btn-border)", "border-start-start-radius": "calc(var(--join-ss, var(--radius-field) - var(--border)))", "border-end-start-radius": "calc(var(--join-es, var(--radius-field) - var(--border)))", "font-weight": 600, "background-color": "var(--btn-bg)", "background-size": "calc(var(--noise) * 100%)", "background-image": "var(--fx-noise)", "text-shadow": "0 0.5px oklch(1 0 0 / calc(var(--depth) * 0.15))", "box-shadow": "0 0.5px 0 0.5px color-mix( in oklab, color-mix(in oklab, white 30%, var(--btn-bg)) calc(var(--depth) * 20%), #0000 ) inset, var(--btn-shadow)", "--size": "calc(var(--size-field, 0.25rem) * 10)", "--btn-bg": "var(--btn-color, var(--color-base-200))", "--btn-fg": "var(--color-base-content)", "--btn-border": "color-mix(in oklab, var(--btn-bg), #000 5%)", "--btn-shadow": "0 3px 2px -2px color-mix(in oklab, var(--btn-bg) 30%, #0000),\n        0 4px 3px -2px color-mix(in oklab, var(--btn-bg) 30%, #0000)" }, ".file-input:focus": { "--input-color": "var(--color-base-content)", "box-shadow": "0 1px color-mix(in oklab, var(--input-color) 10%, #0000)", "outline": "2px solid var(--input-color)", "outline-offset": "2px", "isolation": "isolate" }, ".file-input:has( > input[disabled]), .file-input:is(:disabled, [disabled])": { "cursor": "not-allowed", "border-color": "var(--color-base-200)", "background-color": "var(--color-base-200)", "&::placeholder": { "color": "color-mix(in oklab, var(--color-base-content) 20%, transparent)" }, "box-shadow": "none", "color": "color-mix(in oklch, var(--color-base-content) 20%, #0000)", "&::file-selector-button": { "cursor": "not-allowed", "border-color": "var(--color-base-200)", "background-color": "var(--color-base-200)", "--btn-border": "#0000", "background-image": "none", "--btn-fg": "color-mix(in oklch, var(--color-base-content) 20%, #0000)" } } }, "@layer daisyui.l1.l2": { ".file-input-ghost": { "background-color": "transparent", "transition": "background-color 0.2s", "box-shadow": "none", "border-color": "#0000" }, ".file-input-ghost::file-selector-button": { "margin-inline-start": "0px", "margin-inline-end": "calc(0.25rem * 4)", "height": "100%", "cursor": "pointer", "padding-inline": "calc(0.25rem * 4)", "webkit-user-select": "none", "user-select": "none", "margin-block": "0", "border-start-end-radius": "calc(var(--join-ss, var(--radius-field) - var(--border)))", "border-end-end-radius": "calc(var(--join-es, var(--radius-field) - var(--border)))" }, ".file-input-ghost:focus, .file-input-ghost:focus-within": { "background-color": "var(--color-base-100)", "color": "var(--color-base-content)", "border-color": "#0000", "box-shadow": "none" }, ".file-input-neutral": { "--btn-color": "var(--color-neutral)" }, ".file-input-neutral::file-selector-button": { "color": "var(--color-neutral-content)" }, ":is(.file-input-neutral), .file-input-neutral:focus, .file-input-neutral:focus-within": { "--input-color": "var(--color-neutral)" }, ".file-input-primary": { "--btn-color": "var(--color-primary)" }, ".file-input-primary::file-selector-button": { "color": "var(--color-primary-content)" }, ":is(.file-input-primary), .file-input-primary:focus, .file-input-primary:focus-within": { "--input-color": "var(--color-primary)" }, ".file-input-secondary": { "--btn-color": "var(--color-secondary)" }, ".file-input-secondary::file-selector-button": { "color": "var(--color-secondary-content)" }, ":is(.file-input-secondary), .file-input-secondary:focus, .file-input-secondary:focus-within": { "--input-color": "var(--color-secondary)" }, ".file-input-accent": { "--btn-color": "var(--color-accent)" }, ".file-input-accent::file-selector-button": { "color": "var(--color-accent-content)" }, ":is(.file-input-accent), .file-input-accent:focus, .file-input-accent:focus-within": { "--input-color": "var(--color-accent)" }, ".file-input-info": { "--btn-color": "var(--color-info)" }, ".file-input-info::file-selector-button": { "color": "var(--color-info-content)" }, ":is(.file-input-info), .file-input-info:focus, .file-input-info:focus-within": { "--input-color": "var(--color-info)" }, ".file-input-success": { "--btn-color": "var(--color-success)" }, ".file-input-success::file-selector-button": { "color": "var(--color-success-content)" }, ":is(.file-input-success), .file-input-success:focus, .file-input-success:focus-within": { "--input-color": "var(--color-success)" }, ".file-input-warning": { "--btn-color": "var(--color-warning)" }, ".file-input-warning::file-selector-button": { "color": "var(--color-warning-content)" }, ":is(.file-input-warning), .file-input-warning:focus, .file-input-warning:focus-within": { "--input-color": "var(--color-warning)" }, ".file-input-error": { "--btn-color": "var(--color-error)" }, ".file-input-error::file-selector-button": { "color": "var(--color-error-content)" }, ":is(.file-input-error), .file-input-error:focus, .file-input-error:focus-within": { "--input-color": "var(--color-error)" }, ".file-input-xs": { "--size": "calc(var(--size-field, 0.25rem) * 6)", "font-size": "0.6875rem", "line-height": "1rem" }, ".file-input-xs::file-selector-button": { "font-size": "0.6875rem" }, ".file-input-sm": { "--size": "calc(var(--size-field, 0.25rem) * 8)", "font-size": "0.75rem", "line-height": "1.5rem" }, ".file-input-sm::file-selector-button": { "font-size": "0.75rem" }, ".file-input-md": { "--size": "calc(var(--size-field, 0.25rem) * 10)", "font-size": "0.875rem", "line-height": 2 }, ".file-input-md::file-selector-button": { "font-size": "0.875rem" }, ".file-input-lg": { "--size": "calc(var(--size-field, 0.25rem) * 12)", "font-size": "1.125rem", "line-height": "2.5rem" }, ".file-input-lg::file-selector-button": { "font-size": "1.125rem" }, ".file-input-xl": { "padding-inline-end": "calc(0.25rem * 6)", "--size": "calc(var(--size-field, 0.25rem) * 14)", "font-size": "1.125rem", "line-height": "3rem" }, ".file-input-xl::file-selector-button": { "font-size": "1.375rem" } } };

  // vendor/package/components/fileinput/index.js
  var fileinput_default = ({ addComponents, prefix = "" }) => {
    const prefixedfileinput = addPrefix(object_default43, prefix);
    addComponents({ ...prefixedfileinput });
  };

  // vendor/package/components/carousel/object.js
  var object_default44 = { "@layer daisyui.l1.l2.l3": [{ ".carousel": { "display": "inline-flex", "overflow-x": "scroll", "scroll-snap-type": "x mandatory", "scrollbar-width": "none" }, "@media (prefers-reduced-motion: no-preference)": { ".carousel": { "scroll-behavior": "smooth" } }, ".carousel::-webkit-scrollbar": { "display": "none" } }, { ".carousel-item": { "box-sizing": "content-box", "display": "flex", "flex": "none", "scroll-snap-align": "start" } }], "@layer daisyui.l1.l2": [{ ".carousel-vertical": { "flex-direction": "column", "overflow-y": "scroll", "scroll-snap-type": "y mandatory" }, ".carousel-horizontal": { "flex-direction": "row", "overflow-x": "scroll", "scroll-snap-type": "x mandatory" } }, { ".carousel-start .carousel-item": { "scroll-snap-align": "start" }, ".carousel-center .carousel-item": { "scroll-snap-align": "center" }, ".carousel-end .carousel-item": { "scroll-snap-align": "end" } }] };

  // vendor/package/components/carousel/index.js
  var carousel_default = ({ addComponents, prefix = "" }) => {
    const prefixedcarousel = addPrefix(object_default44, prefix);
    addComponents({ ...prefixedcarousel });
  };

  // vendor/package/components/alert/object.js
  var object_default45 = { ".alert": { "border-width": "var(--border)", "border-color": "var(--alert-border-color, var(--color-base-200))", "@layer daisyui.l1.l2.l3": { "border-style": "solid", "--alert-border-color": "var(--color-base-200)", "display": "grid", "align-items": "center", "gap": "calc(0.25rem * 4)", "border-radius": "var(--radius-box)", "padding-inline": "calc(0.25rem * 4)", "padding-block": "calc(0.25rem * 3)", "color": "var(--color-base-content)", "background-color": "var(--alert-color, var(--color-base-200))", "justify-content": "start", "justify-items": "start", "grid-auto-flow": "column", "grid-template-columns": "auto", "text-align": "start", "font-size": "0.875rem", "line-height": "1.25rem", "background-size": "auto, calc(var(--noise) * 33%)", "background-image": "none, var(--fx-noise)", "box-shadow": "0 3px 0 -2px oklch(100% 0 0 / calc(var(--depth) * 0.08)) inset, 0 1px color-mix( in oklab, color-mix(in oklab, #000 20%, var(--alert-color, var(--color-base-200))) calc(var(--depth) * 20%), #0000 ), 0 4px 3px -2px oklch(0% 0 0 / calc(var(--depth) * 0.08))", "&:has(> :nth-child(2))": { "grid-template-columns": "auto minmax(auto, 1fr)" } } }, "@layer daisyui.l1.l2": [{ ".alert-info": { "color": "var(--color-info-content)", "--alert-border-color": "var(--color-info)", "--alert-color": "var(--color-info)" }, ".alert-success": { "color": "var(--color-success-content)", "--alert-border-color": "var(--color-success)", "--alert-color": "var(--color-success)" }, ".alert-warning": { "color": "var(--color-warning-content)", "--alert-border-color": "var(--color-warning)", "--alert-color": "var(--color-warning)" }, ".alert-error": { "color": "var(--color-error-content)", "--alert-border-color": "var(--color-error)", "--alert-color": "var(--color-error)" } }, { ".alert-vertical": { "justify-content": "center", "justify-items": "center", "grid-auto-flow": "row", "grid-template-columns": "auto", "text-align": "center" }, ".alert-vertical:has( > :nth-child(2))": { "grid-template-columns": "auto" }, ".alert-horizontal": { "justify-content": "start", "justify-items": "start", "grid-auto-flow": "column", "grid-template-columns": "auto", "text-align": "start" }, ".alert-horizontal:has( > :nth-child(2))": { "grid-template-columns": "auto minmax(auto, 1fr)" } }], "@layer daisyui.l1": { ".alert-soft": { "color": "var(--alert-color, var(--color-base-content))", "background": "color-mix( in oklab, var(--alert-color, var(--color-base-content)) 8%, var(--color-base-100) )", "--alert-border-color": "color-mix(\n      in oklab,\n      var(--alert-color, var(--color-base-content)) 10%,\n      var(--color-base-100)\n    )", "box-shadow": "none", "background-image": "none" }, ".alert-outline": { "background-color": "transparent", "color": "var(--alert-color)", "box-shadow": "none", "background-image": "none" }, ".alert-dash": { "background-color": "transparent", "color": "var(--alert-color)", "border-style": "dashed", "box-shadow": "none", "background-image": "none" } } };

  // vendor/package/components/alert/index.js
  var alert_default = ({ addComponents, prefix = "" }) => {
    const prefixedalert = addPrefix(object_default45, prefix);
    addComponents({ ...prefixedalert });
  };

  // vendor/package/components/drawer/object.js
  var object_default46 = { "@layer daisyui.l1.l2.l3": [{ ".drawer": { "position": "relative", "display": "grid", "width": "100%", "grid-auto-columns": "max-content auto" }, ".drawer-content": { "grid-column-start": "2", "grid-row-start": "1", "min-width": "0px" }, ":where(.drawer-side)": { "overflow-x": "hidden", "overflow-y": "hidden" }, ".drawer-side": { "pointer-events": "none", "visibility": "hidden", "position": "fixed", "inset-inline-start": "calc(0.25rem * 0)", "top": "0px", "z-index": 10, "grid-column-start": "1", "grid-row-start": "1", "display": "grid", "width": "100%", "grid-template-columns": "repeat(1, minmax(0, 1fr))", "grid-template-rows": "repeat(1, minmax(0, 1fr))", "align-items": "flex-start", "justify-items": "start", "overscroll-behavior": "contain", "background-color": "transparent", "opacity": "0%", "transition": "opacity 0.2s ease-out 0.1s allow-discrete, visibility 0.3s ease-out 0.1s allow-discrete", "height": ["100vh", "100dvh"] }, ".drawer-side > .drawer-overlay": { "position": "sticky", "top": "0px", "cursor": "pointer", "place-self": "stretch", "background-color": "oklch(0% 0 0 / 40%)" }, ".drawer-side > *": { "grid-column-start": "1", "grid-row-start": "1" }, ".drawer-side > :not(.drawer-overlay)": { "will-change": "transform", "transition": "translate 0.3s ease-out, width 0.2s ease-out", "translate": "-100%", '[dir="rtl"] &': { "translate": "100%" } }, ".drawer-toggle": { "position": "fixed", "height": "0px", "width": "0px", "appearance": "none", "opacity": "0%" }, ":where(.drawer-toggle:checked ~ .drawer-side)": { "scrollbar-color": "color-mix(in oklch, currentColor 35%, #0000) oklch(0 0 0 / calc(var(--page-has-backdrop, 0) * 0.4))", "> :not(.drawer-overlay)": { "transform": "none", "will-change": "auto" } }, ":where(:root:has(.drawer-toggle:checked))": { "--page-scroll-lock": " " } }, { ".drawer-open > .drawer-toggle:checked ~ .drawer-side": { "scrollbar-color": "revert-layer" }, ":root:has(.drawer-open > .drawer-toggle:checked)": { "--page-scroll-lock": "revert-layer" } }], "@layer daisyui.l1.l2": [{ ":where(.drawer-toggle:checked ~ .drawer-side)": { "pointer-events": "auto", "visibility": "visible", "overflow-y": "auto", "opacity": "100%", "> :not(.drawer-overlay)": { "translate": "0%" } }, ".drawer-toggle:focus-visible ~ .drawer-content label.drawer-button": { "outline": "2px solid", "outline-offset": "2px" }, ".drawer-end": { "grid-auto-columns": "auto max-content" }, ".drawer-end > .drawer-toggle ~ .drawer-content": { "grid-column-start": "1" }, ".drawer-end > .drawer-toggle ~ .drawer-side": { "grid-column-start": "2", "justify-items": "end" }, ".drawer-end > .drawer-toggle ~ .drawer-side > :not(.drawer-overlay)": { "translate": "100%", '[dir="rtl"] &': { "translate": "-100%" } }, ".drawer-end > .drawer-toggle:checked ~ .drawer-side > :not(.drawer-overlay)": { "translate": "0%" } }, { ".drawer-open > .drawer-side": { "overflow-y": "auto" }, ".drawer-open > .drawer-toggle": { "display": "none", "~ .drawer-side": { "pointer-events": "auto", "visibility": "visible", "position": "sticky", "display": "block", "width": "auto", "overscroll-behavior": "auto", "opacity": "100%", "> .drawer-overlay": { "cursor": "default", "background-color": "transparent" } }, "&:checked ~ .drawer-side": { "pointer-events": "auto", "visibility": "visible" } } }], "@layer daisyui.l1": { ".drawer-open > .drawer-toggle ~ .drawer-side > :not(.drawer-overlay)": { "translate": "0%", '[dir="rtl"] &': { "translate": "0%" } } } };

  // vendor/package/components/drawer/index.js
  var drawer_default = ({ addComponents, prefix = "" }) => {
    const prefixeddrawer = addPrefix(object_default46, prefix);
    addComponents({ ...prefixeddrawer });
  };

  // vendor/package/components/fab/object.js
  var object_default47 = { "@layer daisyui.l1.l2.l3": { ".fab": { "pointer-events": "none", "position": "fixed", "inset-inline-end": "calc(0.25rem * 4)", "bottom": "calc(0.25rem * 4)", "z-index": 999, "display": "flex", "flex-direction": "column-reverse", "align-items": "flex-end", "gap": "calc(0.25rem * 2)", "white-space": "nowrap", "webkit-user-select": "none", "user-select": "none", "font-size": "0.875rem", "line-height": "1.25rem" }, ".fab > *": { "pointer-events": "auto", "display": "flex", "align-items": "center", "gap": "calc(0.25rem * 2)", "&:hover, &:has(:focus-visible)": { "z-index": 1 } }, ".fab > [tabindex]:first-child": { "position": "relative", "display": "grid", "transition-property": "opacity, visibility, rotate", "transition-duration": "0.2s", "transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)" }, ".fab .fab-close": { "position": "absolute", "inset-inline-end": "calc(0.25rem * 0)", "bottom": "0px" }, ".fab .fab-main-action": { "position": "absolute", "inset-inline-end": "calc(0.25rem * 0)", "bottom": "0px" }, ":is(.fab:focus-within:has(.fab-close), .fab:focus-within:has(.fab-main-action)) > [tabindex]": { "rotate": "90deg", "opacity": "0%" }, ".fab > :nth-child(n + 2)": { "visibility": "hidden", "--tw-scale-x": "80%", "--tw-scale-y": "80%", "--tw-scale-z": "80%", "scale": "var(--tw-scale-x) var(--tw-scale-y)", "opacity": "0%", "transition-property": "opacity, scale, visibility", "transition-duration": "0.2s", "transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)", "&.fab-main-action, &.fab-close": { "--tw-scale-x": "100%", "--tw-scale-y": "100%", "--tw-scale-z": "100%", "scale": "var(--tw-scale-x) var(--tw-scale-y)" } }, ".fab > :nth-child(3)": { "transition-delay": "30ms" }, ".fab > :nth-child(4)": { "transition-delay": "60ms" }, ".fab > :nth-child(5)": { "transition-delay": "90ms" }, ".fab > :nth-child(6)": { "transition-delay": "120ms" }, ".fab:focus-within > [tabindex]:first-child": { "pointer-events": "none" }, ".fab:focus-within > :nth-child(n + 2)": { "visibility": "visible", "--tw-scale-x": "100%", "--tw-scale-y": "100%", "--tw-scale-z": "100%", "scale": "var(--tw-scale-x) var(--tw-scale-y)", "opacity": "100%" }, ".fab-flower": { "display": "grid", "--position": "0rem" }, ".fab-flower > *:nth-child(1), .fab-flower  > .fab-main-action, .fab-flower  > .fab-close": { "--position": "0rem" }, ".fab-flower > *": { "grid-area": "1/1", "--degree": "180deg", "--flip-degree": "calc(180deg - var(--degree))", "transform": "translateX(calc(cos(var(--degree)) * var(--position))) translateY(calc(sin(var(--degree)) * -1 * var(--position)))", '[dir="rtl"] &': { "transform": "translateX(calc(cos(var(--flip-degree)) * var(--position))) translateY(calc(sin(var(--flip-degree)) * -1 * var(--position)))" } }, ".fab-flower > :nth-child(n + 7)": { "display": "none" }, ".fab-flower:has( > :nth-child(3))": { "--position": "140%", "> :nth-child(3)": { "--degree": "135deg" } }, ".fab-flower:has( > :nth-child(4))": { "--position": "140%", "> :nth-child(3)": { "--degree": "165deg" }, "> :nth-child(4)": { "--degree": "105deg" } }, ".fab-flower:has( > :nth-child(5))": { "--position": "180%", "> :nth-child(3)": { "--degree": "180deg" }, "> :nth-child(4)": { "--degree": "135deg" }, "> :nth-child(5)": { "--degree": "90deg" } }, ".fab-flower:has( > :nth-child(6))": { "--position": "220%", "> :nth-child(3)": { "--degree": "180deg" }, "> :nth-child(4)": { "--degree": "150deg" }, "> :nth-child(5)": { "--degree": "120deg" }, "> :nth-child(6)": { "--degree": "90deg" } }, ".fab-flower:not(:has(.fab-main-action, .fab-close)) > :nth-child(n + 6)": { "display": "none" }, ".fab-flower:not(:has(.fab-main-action, .fab-close)):has( > :nth-child(2))": { "--position": "140%", "> :nth-child(2)": { "--degree": "135deg" } }, ".fab-flower:not(:has(.fab-main-action, .fab-close)):has( > :nth-child(3))": { "--position": "140%", "> :nth-child(2)": { "--degree": "165deg" }, "> :nth-child(3)": { "--degree": "105deg" } }, ".fab-flower:not(:has(.fab-main-action, .fab-close)):has( > :nth-child(4))": { "--position": "180%", "> :nth-child(2)": { "--degree": "180deg" }, "> :nth-child(3)": { "--degree": "135deg" }, "> :nth-child(4)": { "--degree": "90deg" } }, ".fab-flower:not(:has(.fab-main-action, .fab-close)):has( > :nth-child(5))": { "--position": "220%", "> :nth-child(2)": { "--degree": "180deg" }, "> :nth-child(3)": { "--degree": "150deg" }, "> :nth-child(4)": { "--degree": "120deg" }, "> :nth-child(5)": { "--degree": "90deg" } } } };

  // vendor/package/components/fab/index.js
  var fab_default = ({ addComponents, prefix = "" }) => {
    const prefixedfab = addPrefix(object_default47, prefix);
    addComponents({ ...prefixedfab });
  };

  // vendor/package/components/input/object.js
  var object_default48 = { "@layer daisyui.l1.l2.l3": { ".input": { "position": "relative", "display": "inline-flex", "flex-shrink": 1, "appearance": "none", "align-items": "center", "gap": "calc(0.25rem * 2)", "background-color": "var(--color-base-100)", "padding-inline": "calc(0.25rem * 3)", "vertical-align": "middle", "white-space": "nowrap", "--size": "calc(var(--size-field, 0.25rem) * var(--in-size-mul, 10))", "--input-color": "color-mix(in oklab, var(--color-base-content) 20%, #0000)", "cursor": "text", "width": "clamp(3rem, 20rem, 100%)", "height": "var(--size)", "font-size": "max(var(--font-size, 0rem), var(--font-size-min, 0.875rem))", "touch-action": "manipulation", "border-start-start-radius": "var(--join-ss, var(--radius-field))", "border-start-end-radius": "var(--join-se, var(--radius-field))", "border-end-start-radius": "var(--join-es, var(--radius-field))", "border-end-end-radius": "var(--join-ee, var(--radius-field))", "border": "var(--border) solid var(--input-color, #0000)", "box-shadow": "0 1px color-mix(in oklab, var(--input-color) calc(var(--depth) * 10%), #0000) inset, 0 -1px oklch(100% 0 0 / calc(var(--depth) * 0.1)) inset" }, ".input input": { "height": "100%", "width": "100%", "appearance": "none", "background-color": "transparent", "border": "none", "&::placeholder": { "color": "var(--color-base-content)", "opacity": "50%" }, "&:focus, &:focus-within": { "--tw-outline-style": "none", "outline-style": "none", "@media (forced-colors: active)": { "outline": "2px solid transparent", "outline-offset": "2px" } }, "&::-webkit-calendar-picker-indicator": { "inset-inline-end": "-0.15em" } }, ".input::-webkit-inner-spin-button": { "margin-inline-end": "-10px" }, ".input::-webkit-calendar-picker-indicator": { "inset-inline-end": "0.75em" }, "input.input, .input  input": { "position": "relative", "display": "inline-flex", "text-align": "start", '&[type="url"], &[type="tel"], &[type="email"], &[type="number"]': { "direction": "ltr" }, "&::-webkit-datetime-edit, &::-webkit-date-and-time-value": { "display": "grid", "min-height": "100%", "align-items": "center", "text-align": "inherit" }, "&::-webkit-inner-spin-button": { "margin-block": "calc(0.25rem * var(--spin-my, -3))" }, "&::-webkit-calendar-picker-indicator": { "position": "absolute", "width": "1em", "height": "1em", "cursor": "pointer" }, "&::-webkit-color-swatch-wrapper": { "padding-block": "0.25rem" } }, ".input:focus, .input:focus-within": { "--input-color": "var(--color-base-content)", "box-shadow": "0 1px color-mix(in oklab, var(--input-color) calc(var(--depth) * 10%), #0000)", "outline": "2px solid var(--input-color)", "outline-offset": "2px" }, "@media (pointer: coarse)": { "@supports (-webkit-touch-callout: none)": { ".input:focus, .input:focus-within": { "--font-size": "1rem" } } }, ".input:has( > input[disabled]), .input:is(:disabled, [disabled]), fieldset:disabled .input": { "cursor": "not-allowed", "border-color": "var(--color-base-200)", "background-color": "var(--color-base-200)", "&:is(input), :is(input)": { "color": "color-mix(in oklab, var(--color-base-content) 40%, transparent)" }, "box-shadow": "none", "&::placeholder, ::placeholder": { "color": "var(--color-base-content)", "opacity": "20%" } }, ".input:has( > input[disabled]) > input[disabled]": { "cursor": "not-allowed" } }, ':is(.input[type="url"], .input[type="tel"], .input[type="email"], .input[type="number"]):dir(rtl)': { "border-start-start-radius": "var(--join-se, var(--radius-field))", "border-start-end-radius": "var(--join-ss, var(--radius-field))", "border-end-start-radius": "var(--join-ee, var(--radius-field))", "border-end-end-radius": "var(--join-es, var(--radius-field))" }, "@layer daisyui.l1.l2": { ".input-ghost": { "background-color": "transparent", "box-shadow": "none", "border-color": "#0000" }, ".input-ghost:focus, .input-ghost:focus-within": { "background-color": "var(--color-base-100)", "color": "var(--color-base-content)", "border-color": "#0000", "box-shadow": "none" }, ":is(.input-neutral), .input-neutral:focus, .input-neutral:focus-within": { "--input-color": "var(--color-neutral)" }, ":is(.input-primary), .input-primary:focus, .input-primary:focus-within": { "--input-color": "var(--color-primary)" }, ":is(.input-secondary), .input-secondary:focus, .input-secondary:focus-within": { "--input-color": "var(--color-secondary)" }, ":is(.input-accent), .input-accent:focus, .input-accent:focus-within": { "--input-color": "var(--color-accent)" }, ":is(.input-info), .input-info:focus, .input-info:focus-within": { "--input-color": "var(--color-info)" }, ":is(.input-success), .input-success:focus, .input-success:focus-within": { "--input-color": "var(--color-success)" }, ":is(.input-warning), .input-warning:focus, .input-warning:focus-within": { "--input-color": "var(--color-warning)" }, ":is(.input-error), .input-error:focus, .input-error:focus-within": { "--input-color": "var(--color-error)" }, ".input-xs": { "--in-size-mul": "6", "--font-size-min": "0.6875rem", "--spin-my": "-1" }, ".floating-label:has(.input-xs)": { "--top-mul": "3", "--font-size": "0.6875rem" }, ".input-sm": { "--in-size-mul": "8", "--font-size-min": "0.75rem", "--spin-my": "-2" }, ".floating-label:has(.input-sm)": { "--top-mul": "4", "--font-size": "0.75rem" }, ".input-md": { "--in-size-mul": "10", "--font-size-min": "0.875rem", "--spin-my": "-3" }, ".floating-label:has(.input-md)": { "--top-mul": "5", "--font-size": "0.875rem" }, ".input-lg": { "--in-size-mul": "12", "--font-size-min": "1.125rem", "--spin-my": "-3" }, ".floating-label:has(.input-lg)": { "--top-mul": "6", "--font-size": "1.125rem" }, ".input-xl": { "--in-size-mul": "14", "--font-size-min": "1.375rem", "--spin-my": "-4" }, ".floating-label:has(.input-xl)": { "--top-mul": "7", "--font-size": "1.375rem" } } };

  // vendor/package/components/input/index.js
  var input_default = ({ addComponents, prefix = "" }) => {
    const prefixedinput = addPrefix(object_default48, prefix);
    addComponents({ ...prefixedinput });
  };

  // vendor/package/components/toast/object.js
  var object_default49 = { "@layer daisyui.l1.l2.l3": { ".toast": { "position": "fixed", "inset-inline-start": "auto", "inset-inline-end": "calc(0.25rem * 4)", "top": "auto", "bottom": "calc(0.25rem * 4)", "display": "flex", "flex-direction": "column", "gap": "calc(0.25rem * 2)", "background-color": "transparent", "translate": "var(--toast-x, 0) var(--toast-y, 0)", "width": "max-content", "max-width": "calc(100vw - 2rem)" }, "@media (prefers-reduced-motion: no-preference)": { ".toast > *": { "animation": "toast 0.25s ease-out" } } }, "@layer daisyui.l1.l2": { ".toast-start": { "inset-inline-start": "calc(0.25rem * 4)", "inset-inline-end": "auto", "--toast-x": "0" }, ".toast-center": { "inset-inline-start": "calc(1/2 * 100%)", "inset-inline-end": "calc(1/2 * 100%)", "--toast-x": "-50%" }, ".toast-center:dir(rtl)": { "--toast-x": "50%" }, ".toast-end": { "inset-inline-start": "auto", "inset-inline-end": "calc(0.25rem * 4)", "--toast-x": "0" }, ".toast-bottom": { "top": "auto", "bottom": "calc(0.25rem * 4)", "--toast-y": "0" }, ".toast-middle": { "top": "calc(1 / 2 * 100%)", "bottom": "auto", "--toast-y": "-50%" }, ".toast-top": { "top": "calc(0.25rem * 4)", "bottom": "auto", "--toast-y": "0" } }, "@keyframes toast": { "0%": { "scale": "0.9", "opacity": 0 }, "100%": { "scale": "1", "opacity": 1 } } };

  // vendor/package/components/toast/index.js
  var toast_default = ({ addComponents, prefix = "" }) => {
    const prefixedtoast = addPrefix(object_default49, prefix);
    addComponents({ ...prefixedtoast });
  };

  // vendor/package/components/menu/object.js
  var object_default50 = { "@layer daisyui.l1.l2.l3": { ".menu": { "display": "flex", "width": "fit-content", "flex-direction": "column", "flex-wrap": "wrap", "padding": "calc(0.25rem * 2)", "--menu-active-fg": "var(--color-neutral-content)", "--menu-active-bg": "var(--color-neutral)", "font-size": "0.875rem" }, ".menu :where(li ul, li menu)": { "position": "relative", "margin-inline-start": "calc(0.25rem * 4)", "padding-inline-start": "calc(0.25rem * 2)", "white-space": "nowrap", "&:before": { "position": "absolute", "inset-inline-start": "calc(0.25rem * 0)", "top": "calc(0.25rem * 3)", "bottom": "calc(0.25rem * 3)", "background-color": "var(--color-base-content)", "opacity": "10%", "width": "var(--border)", "content": '""' } }, ".menu :where(li > .menu-dropdown:not(.menu-dropdown-show))": { "display": "none" }, ".menu :where(li:not(.menu-title) > *:not(ul, menu, details, .menu-title, .btn)), .menu  :where(li:not(.menu-title) > details > summary:not(.menu-title))": { "display": "grid", "grid-auto-flow": "column", "align-content": "flex-start", "align-items": "center", "gap": "calc(0.25rem * 2)", "border-radius": "var(--radius-field)", "padding-inline": "calc(0.25rem * 3)", "padding-block": "calc(0.25rem * 1.5)", "text-align": "start", "transition-property": "color, background-color, box-shadow", "transition-duration": "0.2s", "transition-timing-function": "cubic-bezier(0, 0, 0.2, 1)", "grid-auto-columns": "minmax(auto, max-content) auto max-content", "user-select": "none" }, ".menu :where(li > details > summary)": { "--tw-outline-style": "none", "outline-style": "none", "@media (forced-colors: active)": { "outline": "2px solid transparent", "outline-offset": "2px" }, "&::-webkit-details-marker": { "display": "none" } }, ":is(.menu :where(li > details > summary), .menu  :where(li > .menu-dropdown-toggle)):after": { "justify-self": "flex-end", "display": "block", "height": "0.375rem", "width": "0.375rem", "rotate": "-135deg", "translate": "0 -1px", "transition-property": "rotate, translate", "transition-duration": "0.2s", "content": '""', "transform-origin": "50% 50%", "box-shadow": "2px 2px inset", "pointer-events": "none" }, ".menu details": { "overflow": "hidden", "interpolate-size": "allow-keywords" }, ".menu details::details-content": { "block-size": "0", "@media (prefers-reduced-motion: no-preference)": { "transition-behavior": "allow-discrete", "transition-property": "block-size, content-visibility", "transition-duration": "0.2s", "transition-timing-function": "cubic-bezier(0, 0, 0.2, 1)" } }, ".menu details[open]::details-content": { "block-size": "auto" }, ".menu :where(li > details[open] > summary):after, .menu  :where(li > .menu-dropdown-toggle.menu-dropdown-show):after": { "rotate": "45deg", "translate": "0 1px" }, ".menu :where( li:not(.menu-title, .disabled) > *:not(ul, menu, details, .menu-title), li:not(.menu-title, .disabled) > details > summary:not(.menu-title) ):not(.menu-active, :active, .btn).menu-focus, .menu :where( li:not(.menu-title, .disabled) > *:not(ul, menu, details, .menu-title), li:not(.menu-title, .disabled) > details > summary:not(.menu-title) ):not(.menu-active, :active, .btn):focus-visible": { "cursor": "pointer", "background-color": "color-mix(in oklab, var(--color-base-content) 10%, transparent)", "color": "var(--color-base-content)", "--tw-outline-style": "none", "outline-style": "none", "@media (forced-colors: active)": { "outline": "2px solid transparent", "outline-offset": "2px" } }, ".menu :where( li:not(.menu-title, .disabled) > *:not(ul, menu, details, .menu-title):not(.menu-active, :active, .btn):hover, li:not(.menu-title, .disabled) > details > summary:not(.menu-title):not(.menu-active, :active, .btn):hover )": { "cursor": "pointer", "background-color": "color-mix(in oklab, var(--color-base-content) 10%, transparent)", "--tw-outline-style": "none", "outline-style": "none", "@media (forced-colors: active)": { "outline": "2px solid transparent", "outline-offset": "2px" }, "box-shadow": "0 1px oklch(0% 0 0 / 0.01) inset, 0 -1px oklch(100% 0 0 / 0.01) inset" }, ".menu :where(li:empty)": { "background-color": "var(--color-base-content)", "opacity": "10%", "margin": "0.5rem 1rem", "height": "1px" }, ".menu :where(li)": { "position": "relative", "display": "flex", "flex-shrink": 0, "flex-direction": "column", "flex-wrap": "wrap", "align-items": "stretch", ".badge": { "justify-self": "flex-end" }, "& > *:not(ul, menu, .menu-title, details, .btn):active, & > *:not(ul, menu, .menu-title, details, .btn).menu-active, & > details > summary:active": { "--tw-outline-style": "none", "outline-style": "none", "@media (forced-colors: active)": { "outline": "2px solid transparent", "outline-offset": "2px" }, "color": "var(--menu-active-fg)", "background-color": "var(--menu-active-bg)", "background-size": "auto, calc(var(--noise) * 100%)", "background-image": "none, var(--fx-noise)", "&:not(&:active)": { "box-shadow": "0 2px calc(var(--depth) * 3px) -2px var(--menu-active-bg)" } }, "&.menu-disabled, [disabled]": { "pointer-events": "none", "color": "color-mix(in oklab, var(--color-base-content) 20%, transparent)" } }, ".menu .dropdown:focus-within .menu-dropdown-toggle:after": { "rotate": "45deg", "translate": "0 1px" }, ".menu .dropdown-content": { "margin-top": "calc(0.25rem * 2)", "padding": "calc(0.25rem * 2)", "&:before": { "display": "none" } }, ".menu-title": { "padding-inline": "calc(0.25rem * 3)", "padding-block": "calc(0.25rem * 2)", "color": "color-mix(in oklab, var(--color-base-content) 40%, transparent)", "font-size": "0.875rem", "font-weight": 600 } }, "@layer daisyui.l1.l2": { ".menu-horizontal": { "display": "inline-flex", "flex-direction": "row", "align-items": "flex-start" }, ".menu-horizontal > li:not(.menu-title) > details > :is(ul, menu)": { "position": "absolute", "margin-inline-start": "0px", "margin-top": "calc(0.25rem * 4)", "transform-origin": "top", "border-radius": "var(--radius-box)", "background-color": "var(--color-base-100)", "padding-block": "calc(0.25rem * 2)", "padding-inline-end": "calc(0.25rem * 2)", "opacity": "0%", "scale": "95%", "box-shadow": "0 1px 3px 0 oklch(0% 0 0/0.1), 0 1px 2px -1px oklch(0% 0 0/0.1)", "@media (prefers-reduced-motion: no-preference)": { "@starting-style": { "scale": "95%", "opacity": 0 }, "animation": "menu 0.2s", "transition-property": "opacity, scale, display", "transition-behavior": "allow-discrete", "transition-duration": "0.2s", "transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)" } }, ".menu-horizontal > li:not(.menu-title) > details[open] > :is(ul, menu)": { "opacity": "100%", "scale": "100%" }, ".menu-horizontal > li > details > :is(ul, menu):before": { "--tw-content": "none", "content": "var(--tw-content)" }, ".menu-vertical": { "display": "inline-flex", "flex-direction": "column", "align-items": "stretch" }, ".menu-vertical > li:not(.menu-title) > details > :is(ul, menu)": { "position": "relative", "margin-inline-start": "calc(0.25rem * 4)", "margin-top": "0px", "padding-block": "0px", "padding-inline-end": "0px", "background-color": "revert-layer", "border-radius": "revert-layer", "animation": "revert-layer", "transition": "revert-layer", "box-shadow": "revert-layer" }, ".menu-paged": { "--menu-paged-arrow": "135deg", "--menu-paged-back-arrow": "-45deg" }, '[dir="rtl"] .menu-paged': { "--menu-paged-arrow": "-45deg", "--menu-paged-back-arrow": "135deg" }, ".menu-paged :where(li ul, li menu):before": { "--tw-content": "none", "content": "var(--tw-content)" }, ".menu-paged details[open]>summary": { "font-size": "0", "&:not(:active)": { "transition-duration": "0s" }, "& > *": { "display": "none" }, "&:before": { "--tw-content": '"Back"', "content": "var(--tw-content)", "font-size": "0.875rem" }, "&[aria-label]:before": { "--tw-content": "attr(aria-label)", "content": "var(--tw-content)" } }, ".menu-paged details::details-content": { "transition": "none" }, ".menu-paged:has( > li > details[open]) > li:not(:has( > details[open])), .menu-paged  :where(:is(ul, menu):has(> li > details[open]) > li:not(:has(> details[open])))": { "display": "none" }, ".menu-paged :where(li:has(> details[open]), details[open], details[open] > :is(ul, menu)), .menu-paged  :where(details[open])::details-content": { "display": "contents" }, ".menu-paged :where(details[open]:has(> :is(ul, menu) > li > details[open]) > summary)": { "display": "none" }, ".menu-paged :where(li > details > summary):after": { "rotate": "var(--menu-paged-arrow)", "translate": "0", "transition": "none" }, ".menu-paged :where(li > details[open] > summary):after": { "order": -1, "justify-self": "flex-start", "rotate": "var(--menu-paged-back-arrow)" }, ".menu-xs :where(li:not(.menu-title) > *:not(ul, menu, details, .menu-title)), .menu-xs  :where(li:not(.menu-title) > details > summary:not(.menu-title))": { "border-radius": "var(--radius-field)", "padding-inline": "calc(0.25rem * 2)", "padding-block": "0.25rem", "font-size": "0.6875rem" }, ".menu-xs details[open]>summary:before": { "font-size": "0.6875rem" }, ".menu-xs .menu-title": { "padding-inline": "calc(0.25rem * 2)", "padding-block": "0.25rem" }, ".menu-sm :where(li:not(.menu-title) > *:not(ul, menu, details, .menu-title)), .menu-sm  :where(li:not(.menu-title) > details > summary:not(.menu-title))": { "border-radius": "var(--radius-field)", "padding-inline": "calc(0.25rem * 2.5)", "padding-block": "0.25rem", "font-size": "0.75rem" }, ".menu-sm details[open]>summary:before": { "font-size": "0.75rem" }, ".menu-sm .menu-title": { "padding-inline": "calc(0.25rem * 3)", "padding-block": "calc(0.25rem * 2)" }, ".menu-md :where(li:not(.menu-title) > *:not(ul, menu, details, .menu-title)), .menu-md  :where(li:not(.menu-title) > details > summary:not(.menu-title))": { "border-radius": "var(--radius-field)", "padding-inline": "calc(0.25rem * 3)", "padding-block": "calc(0.25rem * 1.5)", "font-size": "0.875rem" }, ".menu-md details[open]>summary:before": { "font-size": "0.875rem" }, ".menu-md .menu-title": { "padding-inline": "calc(0.25rem * 3)", "padding-block": "calc(0.25rem * 2)" }, ".menu-lg :where(li:not(.menu-title) > *:not(ul, menu, details, .menu-title)), .menu-lg  :where(li:not(.menu-title) > details > summary:not(.menu-title))": { "border-radius": "var(--radius-field)", "padding-inline": "calc(0.25rem * 4)", "padding-block": "calc(0.25rem * 1.5)", "font-size": "1.125rem" }, ".menu-lg details[open]>summary:before": { "font-size": "1.125rem" }, ".menu-lg .menu-title": { "padding-inline": "calc(0.25rem * 6)", "padding-block": "calc(0.25rem * 3)" }, ".menu-xl :where(li:not(.menu-title) > *:not(ul, menu, details, .menu-title)), .menu-xl  :where(li:not(.menu-title) > details > summary:not(.menu-title))": { "border-radius": "var(--radius-field)", "padding-inline": "calc(0.25rem * 5)", "padding-block": "calc(0.25rem * 1.5)", "font-size": "1.375rem" }, ".menu-xl details[open]>summary:before": { "font-size": "1.375rem" }, ".menu-xl .menu-title": { "padding-inline": "calc(0.25rem * 6)", "padding-block": "calc(0.25rem * 3)" }, ":where(:not(ul, menu, details, .menu-title, .btn)).menu-active": { "--tw-outline-style": "none", "outline-style": "none", "color": "var(--menu-active-fg)", "background-color": "var(--menu-active-bg)", "background-size": "auto, calc(var(--noise) * 100%)", "background-image": "none, var(--fx-noise)" }, "@media (forced-colors: active)": { ":where(:not(ul, menu, details, .menu-title, .btn)).menu-active": { "outline": "2px solid transparent", "outline-offset": "2px" } } }, "@keyframes menu": { "0%": { "opacity": 0 } } };

  // vendor/package/components/menu/index.js
  var menu_default = ({ addComponents, prefix = "" }) => {
    const prefixedmenu = addPrefix(object_default50, prefix);
    addComponents({ ...prefixedmenu });
  };

  // vendor/package/components/tab/object.js
  var object_default51 = { "@layer daisyui.l1.l2.l3": { ".tabs": { "display": "flex", "flex-wrap": "wrap", "--tabs-height": "auto", "--tabs-direction": "row", "--tab-height": "calc(var(--size-field, 0.25rem) * 10)", "height": "var(--tabs-height)", "flex-direction": "var(--tabs-direction)" }, ".tab:is(.tabs > .tab)": { "position": "relative", "display": "inline-flex", "cursor": "pointer", "appearance": "none", "flex-wrap": "wrap", "align-items": "center", "justify-content": "center", "text-align": "center", "webkit-user-select": "none", "user-select": "none", "&:hover": { "@media (hover: hover)": { "color": "var(--color-base-content)" } }, "--tab-p": "0.75rem", "--tab-bg": "var(--color-base-100)", "--tab-border-color": "var(--color-base-300)", "--tab-radius-ss": "0", "--tab-radius-se": "0", "--tab-radius-es": "0", "--tab-radius-ee": "0", "--tab-order": "0", "--tab-radius-min": "calc(0.75rem - var(--border))", "--tab-radius-limit": "min(var(--radius-field), var(--tab-radius-min))", "--tab-radius-grad": "#0000 calc(69% - var(--border)), var(--tab-border-color) calc(69% - var(--border) + 0.25px),\n        var(--tab-border-color) 69%, var(--tab-bg) calc(69% + 0.25px)", "border-color": "#0000", "order": "var(--tab-order)", "height": "var(--tab-height)", "font-size": "0.875rem", "padding-inline": "var(--tab-p)", '&:is(input[type="radio"])': { "min-width": "fit-content", "&:after": { "--tw-content": "attr(aria-label)", "content": "var(--tw-content)" } }, "&:is(label)": { "position": "relative", "input": { "position": "absolute", "inset": "0px", "cursor": "pointer", "appearance": "none", "opacity": "0%" } }, '&:checked, &:is(label:has(:checked)), &:is(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"])': { "& + .tab-content": { "display": "block" } }, '&:not( :checked, label:has(:checked), :hover, .tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"] )': { "color": "color-mix(in oklab, var(--color-base-content) 50%, transparent)" }, "&:not(input):empty": { "flex-grow": 1, "cursor": "default" }, "&:focus": { "--tw-outline-style": "none", "outline-style": "none", "@media (forced-colors: active)": { "outline": "2px solid transparent", "outline-offset": "2px" } }, "&:focus-visible, &:is(label:has(:checked:focus-visible))": { "outline": "2px solid currentColor", "outline-offset": "-5px" }, "&[disabled]": { "pointer-events": "none", "opacity": "40%" } }, ".tab-content": { "order": [1, "var(--tabcontent-order)"], "display": "none", "border-color": "transparent", "--tabcontent-radius-ss": "var(--radius-box)", "--tabcontent-radius-se": "var(--radius-box)", "--tabcontent-radius-es": "var(--radius-box)", "--tabcontent-radius-ee": "var(--radius-box)", "--tabcontent-order": "1", "width": "100%", "height": "calc(100% - var(--tab-height) + var(--border))", "margin": "var(--tabcontent-margin)", "border-width": "var(--border)", "border-start-start-radius": "var(--tabcontent-radius-ss)", "border-start-end-radius": "var(--tabcontent-radius-se)", "border-end-start-radius": "var(--tabcontent-radius-es)", "border-end-end-radius": "var(--tabcontent-radius-ee)" } }, "@layer daisyui.l1.l2": { ".tab-disabled": { "pointer-events": "none", "opacity": "40%" }, ".tabs-border > .tab": { "--tab-border-color": "#0000 #0000 var(--tab-border-color) #0000", "position": "relative", "border-radius": "var(--radius-field)", "&:before": { "content": '""', "background-color": "var(--tab-border-color)", "transition": "background-color 0.2s ease", "width": "calc(100% - var(--tab-p) * 2)", "height": "3px", "border-radius": "var(--radius-field)", "bottom": "0", "left": "var(--tab-p)", "position": "absolute" }, '&:is(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"]):not( .tab-disabled, [disabled] ), &:is(input:checked), &:is(label:has(:checked))': { "&:before": { "--tab-border-color": "currentColor", "border-top": "3px solid" } } }, ".tabs-lift": { "--tabs-height": "auto", "--tabs-direction": "row" }, ".tabs-lift > .tab": { "--tab-border": "0 0 var(--border) 0", "--tab-radius-ss": "var(--tab-radius-limit)", "--tab-radius-se": "var(--tab-radius-limit)", "--tab-radius-es": "0", "--tab-radius-ee": "0", "--tab-paddings": "var(--border) var(--tab-p) 0 var(--tab-p)", "--tab-border-colors": "#0000 #0000 var(--tab-border-color) #0000", "--tab-corner-width": "calc(100% + var(--tab-radius-limit) * 2)", "--tab-corner-height": "var(--tab-radius-limit)", "--tab-corner-position": "top left, top right", "border-width": "var(--tab-border)", "border-start-start-radius": "var(--tab-radius-ss)", "border-start-end-radius": "var(--tab-radius-se)", "border-end-start-radius": "var(--tab-radius-es)", "border-end-end-radius": "var(--tab-radius-ee)", "padding": "var(--tab-paddings)", "border-color": "var(--tab-border-colors)", '&:is(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"]):not( .tab-disabled, [disabled] ), &:is(input:checked, label:has(:checked))': { "--tab-border": "var(--border) var(--border) 0 var(--border)", "--tab-border-colors": "var(--tab-border-color) var(--tab-border-color) #0000\n          var(--tab-border-color)", "--tab-paddings": "0 calc(var(--tab-p) - var(--border)) var(--border)\n          calc(var(--tab-p) - var(--border))", "--tab-inset": "auto auto 0 auto", "--radius-start": "radial-gradient(circle at top left, var(--tab-radius-grad))", "--radius-end": "radial-gradient(circle at top right, var(--tab-radius-grad))", "background-color": "var(--tab-bg)", "&:before": { "z-index": 1, "content": '""', "display": "block", "position": "absolute", "width": "var(--tab-corner-width)", "height": "var(--tab-corner-height)", "background-position": "var(--tab-corner-position)", "background-image": "var(--radius-start), var(--radius-end)", "background-size": "var(--tab-radius-limit) var(--tab-radius-limit)", "background-repeat": "no-repeat", "inset": "var(--tab-inset)" }, "&:first-child:before": { "--radius-start": "none" }, '[dir="rtl"] &:first-child:before': { "transform": "rotateY(180deg)" }, "&:last-child:before": { "--radius-end": "none" }, '[dir="rtl"] &:last-child:before': { "transform": "rotateY(180deg)" } } }, '.tabs-lift:has( > .tab-content) > .tab:first-child:not(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"])': { "--tab-border-colors": "var(--tab-border-color) var(--tab-border-color) #0000\n            var(--tab-border-color)" }, ".tabs-lift > .tab-content": { "--tabcontent-margin": "calc(-1 * var(--border)) 0 0 0", "--tabcontent-radius-ss": "0", "--tabcontent-radius-se": "var(--radius-box)", "--tabcontent-radius-es": "var(--radius-box)", "--tabcontent-radius-ee": "var(--radius-box)" }, ':is(.tabs-lift :checked, .tabs-lift  label:has(:checked), .tabs-lift  :is(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"])) + .tab-content:nth-child(1), :is(.tabs-lift :checked, .tabs-lift  label:has(:checked), .tabs-lift  :is(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"])) + .tab-content:nth-child(n + 3)': { "--tabcontent-radius-ss": "var(--radius-box)" }, ".tabs-top": { "--tabs-height": "auto", "--tabs-direction": "row" }, ".tabs-top > .tab": { "--tab-order": "0", "--tab-border": "0 0 var(--border) 0", "--tab-radius-ss": "var(--tab-radius-limit)", "--tab-radius-se": "var(--tab-radius-limit)", "--tab-radius-es": "0", "--tab-radius-ee": "0", "--tab-paddings": "var(--border) var(--tab-p) 0 var(--tab-p)", "--tab-border-colors": "#0000 #0000 var(--tab-border-color) #0000", "--tab-corner-width": "calc(100% + var(--tab-radius-limit) * 2)", "--tab-corner-height": "var(--tab-radius-limit)", "--tab-corner-position": "top left, top right", '&:is(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"]):not( .tab-disabled, [disabled] ), &:is(input:checked), &:is(label:has(:checked))': { "--tab-border": "var(--border) var(--border) 0 var(--border)", "--tab-border-colors": "var(--tab-border-color) var(--tab-border-color) #0000\n          var(--tab-border-color)", "--tab-paddings": "0 calc(var(--tab-p) - var(--border)) var(--border)\n          calc(var(--tab-p) - var(--border))", "--tab-inset": "auto auto 0 auto", "--radius-start": "radial-gradient(circle at top left, var(--tab-radius-grad))", "--radius-end": "radial-gradient(circle at top right, var(--tab-radius-grad))" } }, '.tabs-top:has( > .tab-content) > .tab:first-child:not(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"])': { "--tab-border-colors": "var(--tab-border-color) var(--tab-border-color) #0000\n            var(--tab-border-color)" }, ".tabs-top > .tab-content": { "--tabcontent-order": "1", "--tabcontent-margin": "calc(-1 * var(--border)) 0 0 0", "--tabcontent-radius-ss": "0", "--tabcontent-radius-se": "var(--radius-box)", "--tabcontent-radius-es": "var(--radius-box)", "--tabcontent-radius-ee": "var(--radius-box)" }, ':is(.tabs-top :checked, .tabs-top  label:has(:checked), .tabs-top  :is(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"])) + .tab-content:nth-child(1), :is(.tabs-top :checked, .tabs-top  label:has(:checked), .tabs-top  :is(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"])) + .tab-content:nth-child(n + 3)': { "--tabcontent-radius-ss": "var(--radius-box)" }, ".tabs-bottom": { "--tabs-height": "auto", "--tabs-direction": "row" }, ".tabs-bottom > .tab": { "--tab-order": "1", "--tab-border": "var(--border) 0 0 0", "--tab-radius-ss": "0", "--tab-radius-se": "0", "--tab-radius-es": "var(--tab-radius-limit)", "--tab-radius-ee": "var(--tab-radius-limit)", "--tab-border-colors": "var(--tab-border-color) #0000 #0000 #0000", "--tab-paddings": "0 var(--tab-p) var(--border) var(--tab-p)", "--tab-corner-width": "calc(100% + var(--tab-radius-limit) * 2)", "--tab-corner-height": "var(--tab-radius-limit)", "--tab-corner-position": "top left, top right", '&:is(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"]):not( .tab-disabled, [disabled] ), &:is(input:checked), &:is(label:has(:checked))': { "--tab-border": "0 var(--border) var(--border) var(--border)", "--tab-border-colors": "#0000 var(--tab-border-color) var(--tab-border-color)\n          var(--tab-border-color)", "--tab-paddings": "var(--border) calc(var(--tab-p) - var(--border)) 0\n          calc(var(--tab-p) - var(--border))", "--tab-inset": "0 auto auto auto", "--radius-start": "radial-gradient(circle at bottom left, var(--tab-radius-grad))", "--radius-end": "radial-gradient(circle at bottom right, var(--tab-radius-grad))" } }, '.tabs-bottom:has( > .tab-content) > .tab:first-child:not(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"])': { "--tab-border-colors": "#0000 var(--tab-border-color) var(--tab-border-color)\n            var(--tab-border-color)" }, ".tabs-bottom > .tab-content": { "--tabcontent-order": "0", "--tabcontent-margin": "0 0 calc(-1 * var(--border)) 0", "--tabcontent-radius-ss": "var(--radius-box)", "--tabcontent-radius-se": "var(--radius-box)", "--tabcontent-radius-es": "0", "--tabcontent-radius-ee": "var(--radius-box)" }, ':is(.tabs-bottom > :checked, .tabs-bottom  > :is(label:has(:checked)), .tabs-bottom  > :is(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"])) + .tab-content:not(:nth-child(2))': { "--tabcontent-radius-es": "var(--radius-box)" }, ".tabs-box": { "background-color": "var(--color-base-200)", "padding": "0.25rem", "--tabs-box-radius": "calc(3 * var(--radius-field))", "border-radius": "calc( min(var(--tab-height) / 2, var(--radius-field)) + min(0.25rem, var(--tabs-box-radius)) )", "box-shadow": "0 -0.5px oklch(100% 0 0 / calc(var(--depth) * 0.1)) inset, 0 0.5px oklch(0% 0 0 / calc(var(--depth) * 0.05)) inset" }, ".tabs-box > .tab": { "border-radius": "var(--radius-field)", "border-style": "none", "&:focus-visible, &:is(label:has(:checked:focus-visible))": { "outline-offset": "2px" }, "&:focus-visible": { "z-index": 1 } }, '.tabs-box > :is(.tab-active, [aria-selected="true"], [aria-current="true"], [aria-current="page"]):not( .tab-disabled, [disabled] ), .tabs-box  > :is(input:checked), .tabs-box  > :is(label:has(:checked))': { "background-color": "var(--tab-bg, var(--color-base-100))", "box-shadow": "0 1px oklch(100% 0 0 / calc(var(--depth) * 0.1)) inset, 0 1px 1px -1px color-mix(in oklab, var(--color-neutral) calc(var(--depth) * 50%), #0000), 0 1px 6px -4px color-mix(in oklab, var(--color-neutral) calc(var(--depth) * 100%), #0000)", "@media (forced-colors: active)": { "border": "1px solid" } }, ".tabs-box > .tab-content": { "margin-top": "0.25rem", "height": "calc(100% - var(--tab-height) + var(--border) - 0.5rem)", "border-radius": "calc( min(var(--tab-height) / 2, var(--radius-field)) + min(0.25rem, var(--tabs-box-radius)) - var(--border) )" }, ".tabs-xs": { "--tab-height": "calc(var(--size-field, 0.25rem) * 6)" }, ".tabs-xs > .tab": { "font-size": "0.75rem", "--tab-p": "0.375rem", "--tab-radius-min": "calc(0.5rem - var(--border))" }, ".tabs-sm": { "--tab-height": "calc(var(--size-field, 0.25rem) * 8)" }, ".tabs-sm > .tab": { "font-size": "0.875rem", "--tab-p": "0.5rem", "--tab-radius-min": "calc(0.5rem - var(--border))" }, ".tabs-md": { "--tab-height": "calc(var(--size-field, 0.25rem) * 10)" }, ".tabs-md > .tab": { "font-size": "0.875rem", "--tab-p": "0.75rem", "--tab-radius-min": "calc(0.75rem - var(--border))" }, ".tabs-lg": { "--tab-height": "calc(var(--size-field, 0.25rem) * 12)" }, ".tabs-lg > .tab": { "font-size": "1.125rem", "--tab-p": "1rem", "--tab-radius-min": "calc(1.5rem - var(--border))" }, ".tabs-xl": { "--tab-height": "calc(var(--size-field, 0.25rem) * 14)" }, ".tabs-xl > .tab": { "font-size": "1.125rem", "--tab-p": "1.25rem", "--tab-radius-min": "calc(2rem - var(--border))" } } };

  // vendor/package/components/tab/index.js
  var tab_default = ({ addComponents, prefix = "" }) => {
    const prefixedtab = addPrefix(object_default51, prefix);
    addComponents({ ...prefixedtab });
  };

  // vendor/package/components/navbar/object.js
  var object_default52 = { "@layer daisyui.l1.l2.l3": [{ ".navbar": { "display": "flex", "width": "100%", "align-items": "center", "padding": "0.5rem", "min-height": "4rem" } }, { ".navbar-start": { "display": "inline-flex", "align-items": "center", "width": "50%", "justify-content": "flex-start" }, ".navbar-center": { "display": "inline-flex", "align-items": "center", "flex-shrink": 0 }, ".navbar-end": { "display": "inline-flex", "align-items": "center", "width": "50%", "justify-content": "flex-end" } }], "@layer daisyui.l1.l2": { ":where(.navbar)": { "position": "relative" } } };

  // vendor/package/components/navbar/index.js
  var navbar_default = ({ addComponents, prefix = "" }) => {
    const prefixednavbar = addPrefix(object_default52, prefix);
    addComponents({ ...prefixednavbar });
  };

  // vendor/package/components/countdown/object.js
  var object_default53 = { ".countdown.countdown": { "line-height": "1em" }, "@layer daisyui.l1.l2.l3": { ".countdown": { "display": "inline-flex" }, ".countdown > *": { "visibility": "hidden", "position": "relative", "display": "inline-block", "overflow-y": "clip", "transition": "width 0.4s ease-out 0.2s", "height": "1em", "--value-v": "calc(mod(max(0, var(--value)), 1000))", "--value-hundreds": "calc(round(to-zero, var(--value-v) / 100, 1))", "--value-tens": "calc(round(to-zero, mod(var(--value-v), 100) / 10, 1))", "--value-ones": "calc(mod(var(--value-v), 100))", "--show-hundreds": "clamp(clamp(0, var(--digits, 1) - 2, 1), var(--value-hundreds), 1)", "--show-tens": "clamp(\n        clamp(0, var(--digits, 1) - 1, 1),\n        var(--value-tens) + var(--show-hundreds),\n        1\n      )", "--first-digits": "calc(round(to-zero, var(--value-v) / 10, 1))", "width": "calc(1ch + var(--show-tens) * 1ch + var(--show-hundreds) * 1ch)", "direction": "ltr", "&:before, &:after": { "visibility": "visible", "position": "absolute", "overflow-x": "clip", "--tw-content": '"00\\A 01\\A 02\\A 03\\A 04\\A 05\\A 06\\A 07\\A 08\\A 09\\A 10\\A 11\\A 12\\A 13\\A 14\\A 15\\A 16\\A 17\\A 18\\A 19\\A 20\\A 21\\A 22\\A 23\\A 24\\A 25\\A 26\\A 27\\A 28\\A 29\\A 30\\A 31\\A 32\\A 33\\A 34\\A 35\\A 36\\A 37\\A 38\\A 39\\A 40\\A 41\\A 42\\A 43\\A 44\\A 45\\A 46\\A 47\\A 48\\A 49\\A 50\\A 51\\A 52\\A 53\\A 54\\A 55\\A 56\\A 57\\A 58\\A 59\\A 60\\A 61\\A 62\\A 63\\A 64\\A 65\\A 66\\A 67\\A 68\\A 69\\A 70\\A 71\\A 72\\A 73\\A 74\\A 75\\A 76\\A 77\\A 78\\A 79\\A 80\\A 81\\A 82\\A 83\\A 84\\A 85\\A 86\\A 87\\A 88\\A 89\\A 90\\A 91\\A 92\\A 93\\A 94\\A 95\\A 96\\A 97\\A 98\\A 99\\A"', "content": "var(--tw-content)", "font-variant-numeric": "tabular-nums", "white-space": "pre", "text-align": "end", "direction": "rtl", "transition": "all 1s cubic-bezier(1, 0, 0, 1), width 0.2s ease-out 0.2s, opacity 0.2s ease-out 0.2s" }, "&:before": { "width": "calc(1ch + var(--show-hundreds) * 1ch)", "top": "calc(var(--first-digits) * -1em)", "inset-inline-end": "0", "opacity": "var(--show-tens)" }, "&:after": { "width": "1ch", "top": "calc(var(--value-ones) * -1em)", "inset-inline-start": "0" } } } };

  // vendor/package/components/countdown/index.js
  var countdown_default = ({ addComponents, prefix = "" }) => {
    const prefixedcountdown = addPrefix(object_default53, prefix);
    addComponents({ ...prefixedcountdown });
  };

  // vendor/package/components/textarea/object.js
  var object_default54 = { "@layer daisyui.l1.l2.l3": { ".textarea": { "min-height": "calc(0.25rem * 20)", "flex-shrink": 1, "appearance": "none", "border-radius": "var(--radius-field)", "background-color": "var(--color-base-100)", "padding-inline": "calc(0.25rem * 3)", "padding-block": "calc(0.25rem * 2)", "vertical-align": "middle", "--input-color": "color-mix(in oklab, var(--color-base-content) 20%, #0000)", "width": "clamp(3rem, 20rem, 100%)", "font-size": "max(var(--font-size, 0rem), var(--font-size-min, 0.875rem))", "touch-action": "manipulation", "border": "var(--border) solid var(--input-color, #0000)", "box-shadow": "0 1px color-mix(in oklab, var(--input-color) calc(var(--depth) * 10%), #0000) inset, 0 -1px oklch(100% 0 0 / calc(var(--depth) * 0.1)) inset" }, ".textarea textarea": { "appearance": "none", "background-color": "transparent", "border": "none", "&::placeholder": { "color": "var(--color-base-content)", "opacity": "50%" }, "&:focus, &:focus-within": { "--tw-outline-style": "none", "outline-style": "none", "@media (forced-colors: active)": { "outline": "2px solid transparent", "outline-offset": "2px" } } }, ".textarea:focus, .textarea:focus-within": { "--input-color": "var(--color-base-content)", "box-shadow": "0 1px color-mix(in oklab, var(--input-color) calc(var(--depth) * 10%), #0000)", "outline": "2px solid var(--input-color)", "outline-offset": "2px", "isolation": "isolate" }, "@media (pointer: coarse)": { "@supports (-webkit-touch-callout: none)": { ".textarea:focus, .textarea:focus-within": { "--font-size": "1rem" } } }, ".textarea:has( > textarea[disabled]), .textarea:is(:disabled, [disabled])": { "cursor": "not-allowed", "border-color": "var(--color-base-200)", "background-color": "var(--color-base-200)", "color": "color-mix(in oklab, var(--color-base-content) 40%, transparent)", "box-shadow": "none", "&::placeholder, ::placeholder": { "color": "var(--color-base-content)", "opacity": "20%" } }, ".textarea:has( > textarea[disabled]) > textarea[disabled]": { "cursor": "not-allowed" } }, "@layer daisyui.l1.l2": { ".textarea-ghost": { "background-color": "transparent", "box-shadow": "none", "border-color": "#0000" }, ".textarea-ghost:focus, .textarea-ghost:focus-within": { "background-color": "var(--color-base-100)", "color": "var(--color-base-content)", "border-color": "#0000", "box-shadow": "none" }, ":is(.textarea-neutral), .textarea-neutral:focus, .textarea-neutral:focus-within": { "--input-color": "var(--color-neutral)" }, ":is(.textarea-primary), .textarea-primary:focus, .textarea-primary:focus-within": { "--input-color": "var(--color-primary)" }, ":is(.textarea-secondary), .textarea-secondary:focus, .textarea-secondary:focus-within": { "--input-color": "var(--color-secondary)" }, ":is(.textarea-accent), .textarea-accent:focus, .textarea-accent:focus-within": { "--input-color": "var(--color-accent)" }, ":is(.textarea-info), .textarea-info:focus, .textarea-info:focus-within": { "--input-color": "var(--color-info)" }, ":is(.textarea-success), .textarea-success:focus, .textarea-success:focus-within": { "--input-color": "var(--color-success)" }, ":is(.textarea-warning), .textarea-warning:focus, .textarea-warning:focus-within": { "--input-color": "var(--color-warning)" }, ":is(.textarea-error), .textarea-error:focus, .textarea-error:focus-within": { "--input-color": "var(--color-error)" }, ".textarea-xs": { "--font-size-min": "0.6875rem" }, ".floating-label:has(.textarea-xs)": { "--top-mul": "3", "--font-size": "0.6875rem" }, ".textarea-sm": { "--font-size-min": "0.75rem" }, ".floating-label:has(.textarea-sm)": { "--top-mul": "4", "--font-size": "0.75rem" }, ".textarea-md": { "--font-size-min": "0.875rem" }, ".floating-label:has(.textarea-md)": { "--top-mul": "5", "--font-size": "0.875rem" }, ".textarea-lg": { "--font-size-min": "1.125rem" }, ".floating-label:has(.textarea-lg)": { "--top-mul": "6", "--font-size": "1.125rem" }, ".textarea-xl": { "--font-size-min": "1.375rem" }, ".floating-label:has(.textarea-xl)": { "--top-mul": "7", "--font-size": "1.375rem" } } };

  // vendor/package/components/textarea/index.js
  var textarea_default = ({ addComponents, prefix = "" }) => {
    const prefixedtextarea = addPrefix(object_default54, prefix);
    addComponents({ ...prefixedtextarea });
  };

  // vendor/package/components/card/object.js
  var object_default55 = { "@layer daisyui.l1.l2.l3": [{ ".card": { "position": "relative", "display": "flex", "flex-direction": "column", "border-radius": "var(--radius-box)", "transition": "outline 0.2s ease-in-out", "outline": "2px solid #0000", "outline-offset": "2px" }, '.card:focus-visible, .card[aria-checked="true"], .card:has( > :checked,  > :is([type="checkbox"], [type="radio"]):focus-visible)': { "outline-color": "currentColor" }, '.card:has( > :checked:focus-visible), .card[aria-checked="true"]:focus-visible, .card[aria-checked="true"]:has( > :is([type="checkbox"], [type="radio"]):focus-visible)': { "outline-width": "4px" }, '.card:has( > :is([type="checkbox"], [type="radio"]))': { "cursor": "pointer", "user-select": "none" }, '.card > :is([type="checkbox"], [type="radio"])': { "appearance": "none" } }, { ".card-title": { "display": "flex", "align-items": "center", "gap": "calc(0.25rem * 2)", "font-size": "var(--cardtitle-fs, 1.125rem)", "font-weight": 600 }, ".card-body": { "display": "flex", "flex": "auto", "flex-direction": "column", "gap": "calc(0.25rem * 2)", "padding": "var(--card-p, 1.5rem)", "font-size": "var(--card-fs, 0.875rem)" } }, { ".card-actions": { "display": "flex", "flex-wrap": "wrap", "align-items": "flex-start", "gap": "calc(0.25rem * 2)" } }], "@layer daisyui.l1.l2.l3.l4": [{ ".card figure:first-child": { "overflow": "hidden", "border-start-start-radius": "inherit", "border-start-end-radius": "inherit", "border-end-start-radius": "unset", "border-end-end-radius": "unset" }, ".card figure:last-child": { "overflow": "hidden", "border-start-start-radius": "unset", "border-start-end-radius": "unset", "border-end-start-radius": "inherit", "border-end-end-radius": "inherit" }, ".card figure": { "display": "flex", "align-items": "center", "justify-content": "center" } }, { ".card-body p": { "flex-grow": 1 } }], "@layer daisyui.l1.l2": [{ ".card-border": { "border": "var(--border) solid var(--color-base-200)" }, ".card-dash": { "border": "var(--border) dashed var(--color-base-200)" }, ".image-full": { "display": "grid" }, ".image-full > *": { "grid-column-start": "1", "grid-row-start": "1" }, ".image-full > .card-body": { "position": "relative", "color": "var(--color-neutral-content)" }, ".image-full :where(figure)": { "overflow": "hidden", "border-radius": "inherit" }, ".image-full > figure img": { "height": "100%", "object-fit": "cover", "filter": "brightness(28%)" } }, { ".card-xs .card-body": { "--card-p": "0.5rem", "--card-fs": "0.6875rem" }, ".card-xs .card-title": { "--cardtitle-fs": "0.875rem" }, ".card-sm .card-body": { "--card-p": "1rem", "--card-fs": "0.75rem" }, ".card-sm .card-title": { "--cardtitle-fs": "1rem" }, ".card-md .card-body": { "--card-p": "1.5rem", "--card-fs": "0.875rem" }, ".card-md .card-title": { "--cardtitle-fs": "1.125rem" }, ".card-lg .card-body": { "--card-p": "2rem", "--card-fs": "1rem" }, ".card-lg .card-title": { "--cardtitle-fs": "1.25rem" }, ".card-xl .card-body": { "--card-p": "2.5rem", "--card-fs": "1.125rem" }, ".card-xl .card-title": { "--cardtitle-fs": "1.375rem" }, ".card-side": { "align-items": "stretch", "flex-direction": "row" }, ".card-side :where(figure:first-child)": { "overflow": "hidden", "border-start-start-radius": "inherit", "border-start-end-radius": "unset", "border-end-start-radius": "inherit", "border-end-end-radius": "unset" }, ".card-side :where(figure:last-child)": { "overflow": "hidden", "border-start-start-radius": "unset", "border-start-end-radius": "inherit", "border-end-start-radius": "unset", "border-end-end-radius": "inherit" }, ".card-side figure > *": { "max-width": "unset" }, ".card-side :where(figure > *)": { "width": "100%", "height": "100%", "object-fit": "cover" } }] };

  // vendor/package/components/card/index.js
  var card_default = ({ addComponents, prefix = "" }) => {
    const prefixedcard = addPrefix(object_default55, prefix);
    addComponents({ ...prefixedcard });
  };

  // vendor/package/components/label/object.js
  var object_default56 = { "@layer daisyui.l1.l2.l3": { ".label": { "display": "inline-flex", "align-items": "center", "gap": "calc(0.25rem * 1.5)", "white-space": "nowrap", "color": "color-mix(in oklab, currentcolor 60%, transparent)" }, ".label:has(input)": { "cursor": "pointer" }, ".label:is(.input > *, .select > *)": { "display": "flex", "height": "calc(100% - 0.5rem)", "align-items": "center", "padding-inline": "calc(0.25rem * 3)", "white-space": "nowrap", "font-size": "inherit", "&:first-child": { "margin-inline-start": "calc(0.25rem * -3)", "margin-inline-end": "calc(0.25rem * 3)", "border-inline-end": "var(--border) solid color-mix(in oklab, currentColor 10%, #0000)" }, "&:last-child": { "margin-inline-start": "calc(0.25rem * 3)", "margin-inline-end": "calc(0.25rem * -3)", "border-inline-start": "var(--border) solid color-mix(in oklab, currentColor 10%, #0000)" } }, ".floating-label": { "position": "relative", "display": "flex" }, ".floating-label ::placeholder": { "transition": "top 0.1s ease-out, translate 0.1s ease-out, scale 0.1s ease-out, opacity 0.1s ease-out" }, ".floating-label > span": { "position": "absolute", "inset-inline-start": "calc(0.25rem * 3)", "z-index": 1, "background-color": "var(--color-base-100)", "padding-inline": "0.25rem", "opacity": "0%", "font-size": "var(--font-size, 0.875rem)", "top": "calc(var(--size-field, 0.25rem) * var(--top-mul, 5))", "line-height": 1, "border-radius": "2px", "pointer-events": "none", "translate": "0 -50%", "transition": "top 0.1s ease-out, translate 0.1s ease-out, scale 0.1s ease-out, opacity 0.1s ease-out" }, ":is(.floating-label:focus-within, .floating-label:not(:has(input:placeholder-shown, textarea:placeholder-shown))) ::placeholder": { "opacity": "0%", "top": "0", "translate": "-12.5% calc(-50% - 0.125em)", "scale": "0.75", "pointer-events": "auto" }, ":is(.floating-label:focus-within, .floating-label:not(:has(input:placeholder-shown, textarea:placeholder-shown))) :dir(rtl)::placeholder": { "translate": "12.5% calc(-50% - 0.125em)" }, ":is(.floating-label:focus-within, .floating-label:not(:has(input:placeholder-shown, textarea:placeholder-shown))) > span": { "opacity": "100%", "top": "0", "translate": "-12.5% calc(-50% - 0.125em)", "scale": "0.75", "pointer-events": "auto", "z-index": 2, "&:dir(rtl)": { "translate": "12.5% calc(-50% - 0.125em)" } }, ".floating-label:has(:disabled, [disabled]) > span": { "opacity": "0%" } } };

  // vendor/package/components/label/index.js
  var label_default = ({ addComponents, prefix = "" }) => {
    const prefixedlabel = addPrefix(object_default56, prefix);
    addComponents({ ...prefixedlabel });
  };

  // vendor/package/components/indicator/object.js
  var object_default57 = { "@layer daisyui.l1.l2.l3": { ".indicator": { "position": "relative", "display": "inline-flex", "width": "max-content" }, ".indicator :where(.indicator-item)": { "z-index": 1, "position": "absolute", "white-space": "nowrap", "top": "var(--indicator-t, 0)", "bottom": "var(--indicator-b, auto)", "left": "var(--indicator-s, auto)", "right": "var(--indicator-e, 0)", "translate": "var(--indicator-x, 50%) var(--indicator-y, -50%)" } }, "@layer daisyui.l1.l2": { ".indicator-start": { "--indicator-s": "0", "--indicator-e": "auto", "--indicator-x": "-50%" }, '[dir="rtl"] .indicator-start': { "--indicator-s": "auto", "--indicator-e": "0", "--indicator-x": "50%" }, ".indicator-center": { "--indicator-s": "50%", "--indicator-e": "auto", "--indicator-x": "-50%" }, '[dir="rtl"] .indicator-center': { "--indicator-e": "50%", "--indicator-x": "50%" }, ".indicator-end": { "--indicator-s": "auto", "--indicator-e": "0", "--indicator-x": "50%" }, '[dir="rtl"] .indicator-end': { "--indicator-s": "0", "--indicator-e": "auto", "--indicator-x": "-50%" }, ".indicator-bottom": { "--indicator-t": "auto", "--indicator-b": "0", "--indicator-y": "50%" }, ".indicator-middle": { "--indicator-t": "50%", "--indicator-b": "auto", "--indicator-y": "-50%" }, ".indicator-top": { "--indicator-t": "0", "--indicator-b": "auto", "--indicator-y": "-50%" } } };

  // vendor/package/components/indicator/index.js
  var indicator_default = ({ addComponents, prefix = "" }) => {
    const prefixedindicator = addPrefix(object_default57, prefix);
    addComponents({ ...prefixedindicator });
  };

  // vendor/package/components/progress/object.js
  var object_default58 = { "@layer daisyui.l1.l2.l3": { ".progress": { "position": "relative", "height": "calc(0.25rem * 2)", "width": "100%", "appearance": "none", "overflow": "hidden", "border-radius": "var(--radius-box)", "background-color": "color-mix(in oklab, currentcolor 20%, transparent)", "color": "var(--color-base-content)" }, ".progress:indeterminate": { "background-image": "repeating-linear-gradient( 90deg, currentColor -1%, currentColor 10%, #0000 10%, #0000 90% )", "background-size": "200%", "background-position-x": "15%", "@media (prefers-reduced-motion: no-preference)": { "animation": "progress 5s ease-in-out infinite" }, "@supports (-moz-appearance: none)": { "&::-moz-progress-bar": { "background-color": "transparent", "@media (prefers-reduced-motion: no-preference)": { "animation": "progress 5s ease-in-out infinite", "background-image": "repeating-linear-gradient( 90deg, currentColor -1%, currentColor 10%, #0000 10%, #0000 90% )", "background-size": "200%", "background-position-x": "15%" } } } }, "@supports (-moz-appearance: none)": { ".progress::-moz-progress-bar": { "border-radius": "var(--radius-box)", "background-color": "currentcolor", "@media (prefers-reduced-motion: no-preference)": { "transition": "inline-size 0.3s ease" } } }, "@supports (-webkit-appearance: none)": { ".progress::-webkit-progress-bar": { "border-radius": "var(--radius-box)", "background-color": "transparent" }, ".progress::-webkit-progress-value": { "border-radius": "var(--radius-box)", "background-color": "currentColor", "@media (prefers-reduced-motion: no-preference)": { "transition": "inline-size 0.3s ease" } } } }, "@layer daisyui.l1.l2": { ".progress-primary": { "color": "var(--color-primary)" }, ".progress-secondary": { "color": "var(--color-secondary)" }, ".progress-accent": { "color": "var(--color-accent)" }, ".progress-neutral": { "color": "var(--color-neutral)" }, ".progress-info": { "color": "var(--color-info)" }, ".progress-success": { "color": "var(--color-success)" }, ".progress-warning": { "color": "var(--color-warning)" }, ".progress-error": { "color": "var(--color-error)" } }, "@keyframes progress": { "50%": { "background-position-x": "-115%" } } };

  // vendor/package/components/progress/index.js
  var progress_default = ({ addComponents, prefix = "" }) => {
    const prefixedprogress = addPrefix(object_default58, prefix);
    addComponents({ ...prefixedprogress });
  };

  // vendor/package/components/otp/object.js
  var object_default59 = { "@layer daisyui.l1.l2.l3": { ".otp": { "position": "relative", "display": "inline-flex", "font-family": 'var( --font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace )', "direction": "ltr", "clip-path": "inset(-3.5px 3.5px -3.5px -3.5px)", "border-radius": "var(--radius-field)", "font-size": "1.75rem", "gap": "var(--otp-gap)", "--input-color": "color-mix(in oklab, var(--color-base-content) 20%, #0000)", "--otp-ch": "1ch", "--otp-gap": "calc(var(--otp-ch) * 0.5)", "--otp-w": "calc(var(--otp-ch) * 2)", "--otp-size": "calc(var(--size-field, 0.25rem) * 10)", "--stride": "calc(var(--otp-w) + var(--otp-gap))" }, "@supports (font: -apple-system-body)": { ".otp": { "--otp-ch": "0.618164em" } }, ".otp > input": { "pointer-events": "none", "inset-inline-start": "calc(0.25rem * 0)", "z-index": 1, "margin": "0px", "appearance": "none", "border-style": "var(--tw-border-style)", "border-width": "0px", "background-color": "transparent", "padding": "0px", "outline-style": "var(--tw-outline-style)", "outline-width": "0px", "field-sizing": "content", "padding-inline-start": "calc(var(--otp-ch) * 0.5 - 1px)", "text-indent": "1px", "line-height": 1, "letter-spacing": "calc(var(--stride) - var(--otp-ch))", "font-variant-numeric": "tabular-nums", "&::selection": { "background-color": "transparent", "color": "color-mix(in oklab, var(--color-base-content) 20%, #0000)" }, "&:valid": { "caret-color": "transparent" } }, ".otp:has( > span:nth-child(1))": { "width": "calc(var(--stride) * 1)" }, ".otp:has( > span:nth-child(2))": { "width": "calc(var(--stride) * 2)" }, ".otp:has( > span:nth-child(3))": { "width": "calc(var(--stride) * 3)" }, ".otp:has( > span:nth-child(4))": { "width": "calc(var(--stride) * 4)" }, ".otp:has( > span:nth-child(5))": { "width": "calc(var(--stride) * 5)" }, ".otp:has( > span:nth-child(6))": { "width": "calc(var(--stride) * 6)" }, ".otp:has( > span:nth-child(7))": { "width": "calc(var(--stride) * 7)" }, ".otp:has( > span:nth-child(8))": { "width": "calc(var(--stride) * 8)" }, ".otp > span": { "position": "absolute", "display": "flex", "transition-property": "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to", "transition-timing-function": "var(--tw-ease, var(--default-transition-timing-function))", "transition-duration": "var(--tw-duration, var(--default-transition-duration))", "transition": "border-color 0.2s", "inline-size": "var(--otp-w)", "block-size": "var(--otp-size)", "background-color": "var(--color-base-100)", "border": "var(--border) solid var(--input-color)", "border-radius": "inherit", "outline": "2px solid #0000", "outline-offset": "1px", "box-shadow": "0 1px color-mix(in oklab, var(--input-color) calc(var(--depth) * 10%), #0000) inset, 0 -1px oklch(100% 0 0 / calc(var(--depth) * 0.1)) inset", "&:nth-child(1)": { "left": "0", "@supports (font: -apple-system-body)": { "left": "1px" } }, "&:nth-child(2)": { "left": "calc(var(--stride) * 1)", "transition-delay": "0.02s" }, "&:nth-child(3)": { "left": "calc(var(--stride) * 2)", "transition-delay": "0.04s" }, "&:nth-child(4)": { "left": "calc(var(--stride) * 3)", "transition-delay": "0.06s" }, "&:nth-child(5)": { "left": "calc(var(--stride) * 4)", "transition-delay": "0.08s" }, "&:nth-child(6)": { "left": "calc(var(--stride) * 5)", "transition-delay": "0.1s" }, "&:nth-child(7)": { "left": "calc(var(--stride) * 6)", "transition-delay": "0.12s" }, "&:nth-child(8)": { "left": "calc(var(--stride) * 7)", "transition-delay": "0.14s" } }, ".otp:has(input:valid:focus) > span": { "outline": "2px solid var(--input-color)", "outline-offset": "1px" }, ".otp:has(input:valid:focus):after": { "opacity": 0 }, ".otp:after": { "flex-shrink": 0, "content": '""', "width": "var(--otp-w)", "height": "var(--otp-size)", "border-radius": "var(--radius-field)", "outline": "2px solid #0000", "outline-offset": "1px", "z-index": 10, "margin-inline-start": "calc(-1 * (var(--otp-gap) + var(--otp-ch) * 0.5))" }, ".otp:focus-within": { "--input-color": "var(--color-base-content)", "> span": { "box-shadow": "0 1px color-mix(in oklab, var(--input-color) calc(var(--depth) * 10%), #0000)" }, "&:after": { "outline-color": "var(--input-color)" } }, ".otp:has( > input:disabled)": { "cursor": "not-allowed", "> input": { "color": "color-mix(in oklab, var(--color-base-content) 40%, transparent)" }, "> span": { "border-color": "var(--color-base-200)", "background-color": "var(--color-base-200)", "box-shadow": "none" } } }, ".otp-joined": { "--otp-gap": "0rem", "clip-path": "inset(-3.5px 0 -3.5px -3.5px)", "> span": { "&:first-of-type": { "border-start-end-radius": "0", "border-end-end-radius": "0" }, "&:not(&:last-of-type)": { "border-inline-end-style": "var(--tw-border-style)", "border-inline-end-width": "0px" }, "&:not(&:first-of-type, &:last-of-type)": { "border-radius": "0" }, "&:last-of-type": { "border-start-start-radius": "0", "border-end-start-radius": "0" } }, "&:after": { "outline-offset": "calc((-1 * var(--border)) - 3px)", "@supports (font: -apple-system-body)": { "--otp-w": "calc(var(--otp-ch) * 2 - 1px)" } }, "&:has(input:valid:focus)": { "> span": { "outline-offset": "calc((-1 * var(--border)) - 3px)" } } }, "@layer daisyui.l1.l2": { ".otp-xs": { "font-size": "1.25rem", "--otp-size": "calc(var(--size-field, 0.25rem) * 6)" }, ".otp-sm": { "font-size": "1.5rem", "--otp-size": "calc(var(--size-field, 0.25rem) * 8)" }, ".otp-md": { "font-size": "1.75rem", "--otp-size": "calc(var(--size-field, 0.25rem) * 10)" }, ".otp-lg": { "font-size": "2rem", "--otp-size": "calc(var(--size-field, 0.25rem) * 12)" }, ".otp-xl": { "font-size": "2.5rem", "--otp-size": "calc(var(--size-field, 0.25rem) * 14)" }, ":is(.otp-neutral), .otp-neutral:focus, .otp-neutral:focus-within": { "--input-color": "var(--color-neutral)" }, ":is(.otp-primary), .otp-primary:focus, .otp-primary:focus-within": { "--input-color": "var(--color-primary)" }, ":is(.otp-secondary), .otp-secondary:focus, .otp-secondary:focus-within": { "--input-color": "var(--color-secondary)" }, ":is(.otp-accent), .otp-accent:focus, .otp-accent:focus-within": { "--input-color": "var(--color-accent)" }, ":is(.otp-info), .otp-info:focus, .otp-info:focus-within": { "--input-color": "var(--color-info)" }, ":is(.otp-success), .otp-success:focus, .otp-success:focus-within": { "--input-color": "var(--color-success)" }, ":is(.otp-warning), .otp-warning:focus, .otp-warning:focus-within": { "--input-color": "var(--color-warning)" }, ":is(.otp-error), .otp-error:focus, .otp-error:focus-within": { "--input-color": "var(--color-error)" } } };

  // vendor/package/components/otp/index.js
  var otp_default = ({ addComponents, prefix = "" }) => {
    const prefixedotp = addPrefix(object_default59, prefix);
    addComponents({ ...prefixedotp });
  };

  // vendor/package/components/table/object.js
  var object_default60 = { "@layer daisyui.l1.l2.l3": { ".table": { "font-size": "0.875rem", "position": "relative", "width": "100%", "border-collapse": "separate", "--tw-border-spacing-x": "0px", "--tw-border-spacing-y": "0px", "border-spacing": "var(--tw-border-spacing-x) var(--tw-border-spacing-y)", "border-radius": "var(--radius-box)", "text-align": "left" }, '.table:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)': { "text-align": "right" }, "@media (hover: hover)": { ":is(:is(.table tr.row-hover), .table tr.row-hover:nth-child(even)):hover": { "background-color": "var(--color-base-200)" } }, ".table :where(th, td)": { "padding-inline": "calc(0.25rem * 4)", "padding-block": "calc(0.25rem * 3)", "vertical-align": "middle" }, ".table :where(thead, tfoot)": { "white-space": "nowrap", "color": "color-mix(in oklab, var(--color-base-content) 60%, transparent)", "font-size": "0.875rem", "font-weight": 600 }, ".table :where(tfoot tr:first-child :is(td, th))": { "border-top": "var(--border) solid color-mix(in oklch, var(--color-base-content) 5%, #0000)" }, ".table :where(.table-pin-rows thead)": { "position": "sticky", "top": "0px", "z-index": 1 }, ".table :where(.table-pin-rows tfoot)": { "position": "sticky", "bottom": "0px", "z-index": 1 }, ".table :where(.table-pin-rows :is(thead, tfoot) tr)": { "background-color": "var(--color-base-100)" }, ".table :where(.table-pin-cols tr th)": { "position": "sticky", "right": "0px", "left": "0px", "background-color": "var(--color-base-100)" }, ".table :where(thead tr :is(td, th), tbody tr:not(:last-child) :is(td, th))": { "border-bottom": "var(--border) solid color-mix(in oklch, var(--color-base-content) 5%, #0000)" } }, "@layer daisyui.l1.l2": { ".table-zebra tbody tr:where(:nth-child(even))": { "background-color": "var(--color-base-200)", ":where(.table-pin-cols tr th)": { "background-color": "var(--color-base-200)" } }, "@media (hover: hover)": { ":is(:is(.table-zebra tbody tr.row-hover), .table-zebra tbody tr.row-hover:where(:nth-child(even))):hover": { "background-color": "var(--color-base-300)" } }, ".table-xs :not(thead, tfoot) tr": { "font-size": "0.6875rem" }, ".table-xs :where(th, td)": { "padding-inline": "calc(0.25rem * 2)", "padding-block": "0.25rem" }, ".table-sm :not(thead, tfoot) tr": { "font-size": "0.75rem" }, ".table-sm :where(th, td)": { "padding-inline": "calc(0.25rem * 3)", "padding-block": "calc(0.25rem * 2)" }, ".table-md :not(thead, tfoot) tr": { "font-size": "0.875rem" }, ".table-md :where(th, td)": { "padding-inline": "calc(0.25rem * 4)", "padding-block": "calc(0.25rem * 3)" }, ".table-lg :not(thead, tfoot) tr": { "font-size": "1.125rem" }, ".table-lg :where(th, td)": { "padding-inline": "calc(0.25rem * 5)", "padding-block": "calc(0.25rem * 4)" }, ".table-xl :not(thead, tfoot) tr": { "font-size": "1.375rem" }, ".table-xl :where(th, td)": { "padding-inline": "calc(0.25rem * 6)", "padding-block": "calc(0.25rem * 5)" } } };

  // vendor/package/components/table/index.js
  var table_default = ({ addComponents, prefix = "" }) => {
    const prefixedtable = addPrefix(object_default60, prefix);
    addComponents({ ...prefixedtable });
  };

  // vendor/package/components/hero/object.js
  var object_default61 = { "@layer daisyui.l1.l2.l3": { ".hero": { "display": "grid", "width": "100%", "place-items": "center", "background-size": "cover", "background-position": "center" }, ".hero > *": { "grid-column-start": "1", "grid-row-start": "1" }, ".hero-overlay": { "grid-column-start": "1", "grid-row-start": "1", "height": "100%", "width": "100%", "background-color": "color-mix(in oklab, var(--color-neutral) 50%, transparent)" }, ".hero-content": { "isolation": "isolate", "display": "flex", "max-width": "80rem", "align-items": "center", "justify-content": "center", "gap": "calc(0.25rem * 4)", "padding": "calc(0.25rem * 4)" } } };

  // vendor/package/components/hero/index.js
  var hero_default = ({ addComponents, prefix = "" }) => {
    const prefixedhero = addPrefix(object_default61, prefix);
    addComponents({ ...prefixedhero });
  };

  // vendor/package/components/button/object.js
  var object_default62 = { "@layer daisyui.l1.l2.l3": [{ ":where(.btn)": { "width": "unset" } }, { ".btn": { "--size": "calc(var(--size-field, 0.25rem) * 10)", "--btn-p": "1rem", "--btn-fg": "var(--color-base-content)", "display": "inline-flex", "flex-shrink": 0, "cursor": "pointer", "flex-wrap": "nowrap", "align-items": "center", "justify-content": "center", "gap": "calc(0.25rem * 1.5)", "text-align": "center", "vertical-align": "middle", "outline-offset": "2px", "webkit-user-select": "none", "user-select": "none", "font-weight": 600, "border-start-start-radius": "var(--join-ss, var(--radius-field))", "border-start-end-radius": "var(--join-se, var(--radius-field))", "border-end-start-radius": "var(--join-es, var(--radius-field))", "border-end-end-radius": "var(--join-ee, var(--radius-field))", "border-width": "var(--border)", "touch-action": "manipulation", "transition-property": "color, background-color, border-color, box-shadow, transform", "transition-timing-function": "cubic-bezier(0, 0, 0.2, 1)", "transition-duration": "0.2s", "--btn-bg": "var(--btn-color, var(--color-base-200))", "--btn-border": "color-mix(\n      in oklab,\n      var(--btn-color, var(--color-base-200)),\n      #000 calc(var(--depth) * 5%)\n    )", "--btn-soft-bg": "initial", "--btn-shadow": "0 3px 2px -2px color-mix(in oklab, var(--btn-bg) calc(var(--depth) * 30%), #0000),\n      0 4px 3px -2px color-mix(in oklab, var(--btn-bg) calc(var(--depth) * 30%), #0000)", "--btn-inset": "0 0.5px 0 0.5px oklch(100% 0 0 / calc(var(--depth) * 6%))", "height": "var(--size)", "padding-inline": "var(--btn-p)", "font-size": "var(--fontsize, 0.875rem)", "background-color": "var(--btn-bg)", "color": "var(--btn-fg)", "border-color": "var(--btn-border)", "border-style": "var(--btn-border-style, solid)", "outline-color": "var(--btn-color, var(--color-base-content))", "--tw-prose-links": "var(--btn-fg)", "background-image": "none, var(--fx-noise)", "background-size": "auto, calc(var(--noise, 0) * 100%)", "text-shadow": "0 0.5px oklch(100% 0 0 / calc(var(--depth) * 0.15))", "box-shadow": "var(--btn-inset) inset, var(--btn-shadow)" }, '.btn:is([type="checkbox"], [type="radio"])': { "appearance": "none", "&[aria-label]::after": { "--tw-content": "attr(aria-label)", "content": "var(--tw-content)" } }, '.btn:where(:checked:not(.filter [type="radio"].btn))': { "--btn-color": "var(--color-primary)", "--btn-fg": "var(--color-primary-content)" } }, { ".btn-outline, .btn-dash": { "--btn-bg": "#0000", "color": "var(--btn-rest-fg, var(--btn-color, var(--color-base-content)))", "--btn-border": "var(--btn-color, var(--color-base-content))", "--btn-border-style": "solid", "background-image": "none", "--btn-inset": "0 0 0 0 oklch(0% 0 0/0)", "--btn-shadow": "0 0 0 0 oklch(0% 0 0/0)" }, ".btn-dash": { "--btn-border-style": "dashed" }, ".btn-ghost": { "--btn-bg": "#0000", "color": "var(--btn-rest-fg, var(--btn-color, var(--color-base-content, currentColor)))", "--btn-border": "#0000", "background-image": "none", "--btn-inset": "0 0 0 0 oklch(0% 0 0/0)", "--btn-shadow": "0 0 0 0 oklch(0% 0 0/0)" }, ".btn-soft": { "--btn-bg": "color-mix(\n      in oklab,\n      var(--btn-color, var(--color-base-content)) 8%,\n      var(--btn-soft-bg, var(--color-base-100))\n    )", "color": "var(--btn-rest-fg, var(--btn-color, var(--color-base-content)))", "--btn-border": "color-mix(\n      in oklab,\n      var(--btn-color, var(--color-base-content)) 10%,\n      var(--btn-soft-bg, var(--color-base-100))\n    )", "--btn-border-style": "solid", "background-image": "none", "--btn-inset": "0 0 0 0 oklch(0% 0 0/0)", "--btn-shadow": "0 0 0 0 oklch(0% 0 0/0)" } }], '.prose :where(a.btn:not(.btn-link)):not(:where([class~="not-prose"], [class~="not-prose"] *))': { "text-decoration-line": "none" }, "@layer daisyui.l1": { "@media (hover: hover)": { ".btn:hover": { "--btn-bg": "color-mix(in oklab, var(--btn-color, var(--color-base-200)), #000 7%)", "color": "var(--btn-fg)", "--btn-border": "color-mix(in oklab, var(--btn-bg), #000 calc(var(--depth) * 5%))", "--btn-border-style": "solid", "--btn-inset": "0 0.5px 0 0.5px oklch(100% 0 0 / calc(var(--depth) * 6%))", "--btn-shadow": "0 3px 2px -2px color-mix(in oklab, var(--btn-bg) calc(var(--depth) * 30%), #0000),\n          0 4px 3px -2px color-mix(in oklab, var(--btn-bg) calc(var(--depth) * 30%), #0000)" } }, ".btn:active:not(.btn-active)": { "translate": "0 0.5px", "--btn-bg": "color-mix(in oklab, var(--btn-color, var(--color-base-200)), #000 5%)", "color": "var(--btn-fg, var(--color-base-content))", "--btn-border": "color-mix(in oklab, var(--btn-color, var(--color-base-200)), #000 7%)", "--btn-border-style": "solid", "--btn-inset": "0 0 0 0 oklch(0% 0 0/0)", "--btn-shadow": "0 0 0 0 oklch(0% 0 0/0)" }, '.btn:where(:checked:not(.filter [type="radio"].btn), :not([type="radio"], [type="checkbox"]):focus-visible )': { "--btn-bg": "var(--btn-color, var(--color-base-200))", "color": "var(--btn-fg, var(--color-base-content))", "--btn-border": "color-mix(in oklab, var(--btn-bg), #000 calc(var(--depth) * 5%))", "--btn-border-style": "solid", "--btn-inset": "0 0.5px 0 0.5px oklch(100% 0 0 / calc(var(--depth) * 6%))", "--btn-shadow": "0 3px 2px -2px color-mix(in oklab, var(--btn-bg) calc(var(--depth) * 30%), #0000),\n        0 4px 3px -2px color-mix(in oklab, var(--btn-bg) calc(var(--depth) * 30%), #0000)", "isolation": "isolate" }, ".btn:focus-visible, .btn:has(:focus-visible)": { "outline-width": "2px", "outline-style": "solid", "isolation": "isolate" } }, "@layer daisyui.l1.l2": [{ ".btn-active": { "--btn-bg": "color-mix(in oklab, var(--btn-color, var(--color-base-200)), #000 5%)", "color": "var(--btn-fg, var(--color-base-content))", "--btn-border": "color-mix(in oklab, var(--btn-color, var(--color-base-200)), #000 7%)", "--btn-border-style": "solid", "--btn-inset": "0 0 0 0 oklch(0% 0 0/0)", "--btn-shadow": "0 0 0 0 oklch(0% 0 0/0)", "isolation": "isolate" } }, { ".btn-primary": { "--btn-color": "var(--color-primary)", "--btn-fg": "var(--color-primary-content)", "--btn-soft-bg": "initial" }, ".btn-secondary": { "--btn-color": "var(--color-secondary)", "--btn-fg": "var(--color-secondary-content)", "--btn-soft-bg": "initial" }, ".btn-accent": { "--btn-color": "var(--color-accent)", "--btn-fg": "var(--color-accent-content)", "--btn-soft-bg": "initial" }, ".btn-neutral": { "--btn-color": "var(--color-neutral)", "--btn-fg": "var(--color-neutral-content)", "--btn-soft-bg": "var(--color-neutral-content) 80%", "--btn-rest-fg": "initial" }, ".btn-info": { "--btn-color": "var(--color-info)", "--btn-fg": "var(--color-info-content)", "--btn-soft-bg": "initial" }, ".btn-success": { "--btn-color": "var(--color-success)", "--btn-fg": "var(--color-success-content)", "--btn-soft-bg": "initial" }, ".btn-warning": { "--btn-color": "var(--color-warning)", "--btn-fg": "var(--color-warning-content)", "--btn-soft-bg": "initial" }, ".btn-error": { "--btn-color": "var(--color-error)", "--btn-fg": "var(--color-error-content)", "--btn-soft-bg": "initial" }, ".btn-xs": { "--fontsize": "0.6875rem", "--btn-p": "0.5rem", "--size": "calc(var(--size-field, 0.25rem) * 6)" }, ".btn-sm": { "--fontsize": "0.75rem", "--btn-p": "0.75rem", "--size": "calc(var(--size-field, 0.25rem) * 8)" }, ".btn-md": { "--fontsize": "0.875rem", "--btn-p": "1rem", "--size": "calc(var(--size-field, 0.25rem) * 10)" }, ".btn-lg": { "--fontsize": "1.125rem", "--btn-p": "1.25rem", "--size": "calc(var(--size-field, 0.25rem) * 12)" }, ".btn-xl": { "--fontsize": "1.375rem", "--btn-p": "1.5rem", "--size": "calc(var(--size-field, 0.25rem) * 14)" }, ".btn-wide": { "width": "100%", "max-width": "calc(0.25rem * 64)" }, ".btn-block": { "width": "100%" }, ".btn-square": { "padding-inline": "0px", "width": "var(--size)", "height": "var(--size)" }, ".btn-circle": { "border-radius": "calc(infinity * 1px)", "padding-inline": "0px", "width": "var(--size)", "height": "var(--size)" } }], "@layer daisyui": [{ ".btn-link": { "text-decoration-line": "underline", "--btn-bg": "#0000", "color": "var(--btn-color, var(--color-primary))", "--btn-border": "#0000", "background-image": "none", "--btn-inset": "0 0 0 0 oklch(0% 0 0/0)", "--btn-shadow": "0 0 0 0 oklch(0% 0 0/0)" } }, { '.btn-disabled, .btn:is(:disabled, [disabled], [aria-disabled="true"])': { "pointer-events": "none", "color": "color-mix(in oklch, var(--color-base-content) 20%, #0000)", "--btn-bg": "#0000", "--btn-border": "#0000", "background-image": "none", "--btn-inset": "0 0 0 0 oklch(0% 0 0/0)", "--btn-shadow": "0 0 0 0 oklch(0% 0 0/0)" }, ':is(.btn-disabled, .btn:is(:disabled, [disabled], [aria-disabled="true"])):not(.btn-link, .btn-ghost)': { "background-color": "color-mix(in oklab, var(--color-base-content) 10%, transparent)" } }] };

  // vendor/package/components/button/index.js
  var button_default = ({ addComponents, prefix = "" }) => {
    const prefixedbutton = addPrefix(object_default62, prefix);
    addComponents({ ...prefixedbutton });
  };

  // vendor/package/components/validator/object.js
  var object_default63 = { "@layer daisyui.l1.l2.l3": { ':is(.validator:user-valid, .validator:has(:user-valid)), :is(.validator:user-valid, .validator:has(:user-valid)):focus, :is(.validator:user-valid, .validator:has(:user-valid)):checked, :is(.validator:user-valid, .validator:has(:user-valid))[aria-checked="true"], :is(.validator:user-valid, .validator:has(:user-valid)):focus-within': { "--input-color": "var(--color-success)" }, ':is(.validator:user-invalid, .validator:has(:user-invalid), .validator[aria-invalid]:not([aria-invalid="false"]), .validator:has([aria-invalid]:not([aria-invalid="false"]))), :is(.validator:user-invalid, .validator:has(:user-invalid), .validator[aria-invalid]:not([aria-invalid="false"]), .validator:has([aria-invalid]:not([aria-invalid="false"]))):focus, :is(.validator:user-invalid, .validator:has(:user-invalid), .validator[aria-invalid]:not([aria-invalid="false"]), .validator:has([aria-invalid]:not([aria-invalid="false"]))):checked, :is(.validator:user-invalid, .validator:has(:user-invalid), .validator[aria-invalid]:not([aria-invalid="false"]), .validator:has([aria-invalid]:not([aria-invalid="false"])))[aria-checked="true"], :is(.validator:user-invalid, .validator:has(:user-invalid), .validator[aria-invalid]:not([aria-invalid="false"]), .validator:has([aria-invalid]:not([aria-invalid="false"]))):focus-within': { "--input-color": "var(--color-error)" }, ':is(.validator:user-invalid, .validator:has(:user-invalid), .validator[aria-invalid]:not([aria-invalid="false"]), .validator:has([aria-invalid]:not([aria-invalid="false"]))) ~ .validator-hint': { "visibility": "visible", "color": "var(--color-error)" }, ".validator-hint": { "visibility": "hidden", "margin-top": "calc(0.25rem * 2)", "font-size": "0.75rem" } }, ':is(.validator:user-invalid, .validator:has(:user-invalid), .validator[aria-invalid]:not([aria-invalid="false"]), .validator:has([aria-invalid]:not([aria-invalid="false"]))) ~ .validator-hint': { "display": "revert-layer" } };

  // vendor/package/components/validator/index.js
  var validator_default = ({ addComponents, prefix = "" }) => {
    const prefixedvalidator = addPrefix(object_default63, prefix);
    addComponents({ ...prefixedvalidator });
  };

  // vendor/package/components/timeline/object.js
  var object_default64 = { "@layer daisyui.l1.l2.l3": { ".timeline": { "position": "relative", "display": "flex" }, ".timeline > li": { "position": "relative", "display": "grid", "flex-shrink": 0, "align-items": "center", "grid-template-rows": "var(--timeline-row-start, minmax(0, 1fr)) auto var( --timeline-row-end, minmax(0, 1fr) )", "grid-template-columns": "var(--timeline-col-start, minmax(0, 1fr)) auto var( --timeline-col-end, minmax(0, 1fr) )", "> hr": { "border": "none", "width": "100%", "&:first-child": { "grid-column-start": "1", "grid-row-start": "2" }, "&:last-child": { "grid-column-start": "3", "grid-column-end": "none", "grid-row-start": "2", "grid-row-end": "auto" }, "@media print": { "border": "0.1px solid var(--color-base-300)" } } }, ".timeline :where(hr)": { "height": "0.25rem", "background-color": "var(--color-base-300)" }, ".timeline:has(.timeline-middle hr):first-child": { "border-start-start-radius": "0", "border-end-start-radius": "0", "border-start-end-radius": "var(--radius-selector)", "border-end-end-radius": "var(--radius-selector)" }, ".timeline:has(.timeline-middle hr):last-child": { "border-start-start-radius": "var(--radius-selector)", "border-end-start-radius": "var(--radius-selector)", "border-start-end-radius": "0", "border-end-end-radius": "0" }, ".timeline:not(:has(.timeline-middle)) :first-child hr:last-child": { "border-start-start-radius": "var(--radius-selector)", "border-end-start-radius": "var(--radius-selector)", "border-start-end-radius": "0", "border-end-end-radius": "0" }, ".timeline:not(:has(.timeline-middle)) :last-child hr:first-child": { "border-start-start-radius": "0", "border-end-start-radius": "0", "border-start-end-radius": "var(--radius-selector)", "border-end-end-radius": "var(--radius-selector)" }, ".timeline-box": { "border": "var(--border) solid", "border-radius": "var(--radius-box)", "border-color": "var(--color-base-300)", "background-color": "var(--color-base-100)", "padding-inline": "calc(0.25rem * 4)", "padding-block": "calc(0.25rem * 2)", "font-size": "0.75rem", "box-shadow": "0 1px 2px 0 oklch(0% 0 0/0.05)" }, ".timeline-start": { "grid-column-start": "1", "grid-column-end": "4", "grid-row-start": "1", "grid-row-end": "2", "margin": "0.25rem", "align-self": "flex-end", "justify-self": "center" }, ".timeline-middle": { "grid-column-start": "2", "grid-row-start": "2" }, ".timeline-end": { "grid-column-start": "1", "grid-column-end": "4", "grid-row-start": "3", "grid-row-end": "4", "margin": "0.25rem", "align-self": "flex-start", "justify-self": "center" } }, "@layer daisyui.l1.l2": { ".timeline-compact": { "--timeline-row-start": "0" }, ".timeline-compact .timeline-start": { "grid-column-start": "1", "grid-column-end": "4", "grid-row-start": "3", "grid-row-end": "4", "align-self": "flex-start", "justify-self": "center" }, ".timeline-compact li:has(.timeline-start) .timeline-end": { "grid-column-start": "none", "grid-row-start": "auto" }, ".timeline-compact.timeline-vertical > li": { "--timeline-col-start": "0" }, ".timeline-compact.timeline-vertical .timeline-start": { "grid-column-start": "3", "grid-column-end": "4", "grid-row-start": "1", "grid-row-end": "4", "align-self": "center", "justify-self": "flex-start" }, ".timeline-compact.timeline-vertical li:has(.timeline-start) .timeline-end": { "grid-column-start": "auto", "grid-row-start": "none" }, ".timeline-snap-icon > li": { "--timeline-col-start": "0.5rem", "--timeline-row-start": "minmax(0, 1fr)" }, ".timeline-vertical": { "flex-direction": "column" }, ".timeline-vertical > li": { "justify-items": "center", "--timeline-row-start": "minmax(0, 1fr)", "--timeline-row-end": "minmax(0, 1fr)", "> hr": { "height": "100%", "width": "0.25rem", "&:first-child": { "grid-column-start": "2", "grid-row-start": "1" }, "&:last-child": { "grid-column-start": "2", "grid-column-end": "auto", "grid-row-start": "3", "grid-row-end": "none" } } }, ".timeline-vertical .timeline-start": { "grid-column-start": "1", "grid-column-end": "2", "grid-row-start": "1", "grid-row-end": "4", "align-self": "center", "justify-self": "flex-end" }, ".timeline-vertical .timeline-end": { "grid-column-start": "3", "grid-column-end": "4", "grid-row-start": "1", "grid-row-end": "4", "align-self": "center", "justify-self": "flex-start" }, ".timeline-vertical:has(.timeline-middle) > li > hr:first-child": { "border-top-left-radius": "0", "border-top-right-radius": "0", "border-bottom-right-radius": "var(--radius-selector)", "border-bottom-left-radius": "var(--radius-selector)" }, ".timeline-vertical:has(.timeline-middle) > li > hr:last-child": { "border-top-left-radius": "var(--radius-selector)", "border-top-right-radius": "var(--radius-selector)", "border-bottom-right-radius": "0", "border-bottom-left-radius": "0" }, ".timeline-vertical:not(:has(.timeline-middle)) :first-child > hr:last-child": { "border-top-left-radius": "var(--radius-selector)", "border-top-right-radius": "var(--radius-selector)", "border-bottom-right-radius": "0", "border-bottom-left-radius": "0" }, ".timeline-vertical:not(:has(.timeline-middle)) :last-child > hr:first-child": { "border-top-left-radius": "0", "border-top-right-radius": "0", "border-bottom-right-radius": "var(--radius-selector)", "border-bottom-left-radius": "var(--radius-selector)" }, ".timeline-vertical.timeline-snap-icon > li": { "--timeline-col-start": "minmax(0, 1fr)", "--timeline-row-start": "0.5rem" }, ".timeline-horizontal": { "flex-direction": "row" }, ".timeline-horizontal > li": { "align-items": "center", "> hr": { "height": "0.25rem", "width": "100%", "&:first-child": { "grid-column-start": "1", "grid-row-start": "2" }, "&:last-child": { "grid-column-start": "3", "grid-column-end": "none", "grid-row-start": "2", "grid-row-end": "auto" } } }, ".timeline-horizontal .timeline-start": { "grid-column-start": "1", "grid-column-end": "4", "grid-row-start": "1", "grid-row-end": "2", "align-self": "flex-end", "justify-self": "center" }, ".timeline-horizontal .timeline-end": { "grid-column-start": "1", "grid-column-end": "4", "grid-row-start": "3", "grid-row-end": "4", "align-self": "flex-start", "justify-self": "center" }, ".timeline-horizontal:has(.timeline-middle) > li > hr:first-child": { "border-start-start-radius": "0", "border-end-start-radius": "0", "border-start-end-radius": "var(--radius-selector)", "border-end-end-radius": "var(--radius-selector)" }, ".timeline-horizontal:has(.timeline-middle) > li > hr:last-child": { "border-start-start-radius": "var(--radius-selector)", "border-end-start-radius": "var(--radius-selector)", "border-start-end-radius": "0", "border-end-end-radius": "0" }, ".timeline-horizontal:not(:has(.timeline-middle)) :first-child > hr:last-child": { "border-start-start-radius": "var(--radius-selector)", "border-end-start-radius": "var(--radius-selector)", "border-start-end-radius": "0", "border-end-end-radius": "0" }, ".timeline-horizontal:not(:has(.timeline-middle)) :last-child > hr:first-child": { "border-start-start-radius": "0", "border-end-start-radius": "0", "border-start-end-radius": "var(--radius-selector)", "border-end-end-radius": "var(--radius-selector)" } } };

  // vendor/package/components/timeline/index.js
  var timeline_default = ({ addComponents, prefix = "" }) => {
    const prefixedtimeline = addPrefix(object_default64, prefix);
    addComponents({ ...prefixedtimeline });
  };

  // vendor/package/components/footer/object.js
  var object_default65 = { "@layer daisyui.l1.l2.l3": [{ ".footer": { "display": "grid", "width": "100%", "grid-auto-flow": "row", "place-items": "start", "column-gap": "calc(0.25rem * 4)", "row-gap": "calc(0.25rem * 10)", "font-size": "0.875rem", "line-height": "1.25rem" }, ".footer > :not(script, style, template)": { "display": "grid", "place-items": "start", "gap": "calc(0.25rem * 2)" } }, { ".footer-title": { "margin-bottom": "calc(0.25rem * 2)", "text-transform": "uppercase", "opacity": "60%", "font-weight": 600 } }], "@layer daisyui.l1.l2": [{ ".footer-center": { "grid-auto-flow": "column dense", "place-items": "center", "text-align": "center" }, ".footer-center > :not(script, style, template)": { "place-items": "center" } }, { ".footer-horizontal": { "grid-auto-flow": "column" }, ".footer-horizontal.footer-center": { "grid-auto-flow": "row dense" }, ".footer-vertical": { "grid-auto-flow": "row" }, ".footer-vertical.footer-center": { "grid-auto-flow": "column dense" } }] };

  // vendor/package/components/footer/index.js
  var footer_default = ({ addComponents, prefix = "" }) => {
    const prefixedfooter = addPrefix(object_default65, prefix);
    addComponents({ ...prefixedfooter });
  };

  // vendor/package/components/loading/object.js
  var object_default66 = { "@layer daisyui.l1.l2.l3": { ".loading": { "pointer-events": "none", "display": "inline-block", "aspect-ratio": "1 / 1", "flex-shrink": 0, "background-color": "currentcolor", "vertical-align": "middle", "width": "calc(var(--size-selector, 0.25rem) * 6)", "mask-size": "100%", "mask-repeat": "no-repeat", "mask-position": "center", "mask-image": `url("data:image/svg+xml,%3Csvg width='24' height='24' stroke='black' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cg transform-origin='center'%3E%3Ccircle cx='12' cy='12' r='9.5' fill='none' stroke-width='3' stroke-linecap='round'%3E%3CanimateTransform attributeName='transform' type='rotate' from='0 12 12' to='360 12 12' dur='8s' repeatCount='indefinite'/%3E%3Canimate attributeName='stroke-dasharray' values='0,150;42,150;42,150' keyTimes='0;0.475;1' dur='6s' repeatCount='indefinite'/%3E%3Canimate attributeName='stroke-dashoffset' values='0;-16;-59' keyTimes='0;0.475;1' dur='6s' repeatCount='indefinite'/%3E%3C/circle%3E%3C/g%3E%3C/svg%3E")` }, "@media (prefers-reduced-motion: no-preference)": { ".loading": { "mask-image": `url("data:image/svg+xml,%3Csvg width='24' height='24' stroke='black' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cg transform-origin='center'%3E%3Ccircle cx='12' cy='12' r='9.5' fill='none' stroke-width='3' stroke-linecap='round'%3E%3CanimateTransform attributeName='transform' type='rotate' from='0 12 12' to='360 12 12' dur='2s' repeatCount='indefinite'/%3E%3Canimate attributeName='stroke-dasharray' values='0,150;42,150;42,150' keyTimes='0;0.475;1' dur='1.5s' repeatCount='indefinite'/%3E%3Canimate attributeName='stroke-dashoffset' values='0;-16;-59' keyTimes='0;0.475;1' dur='1.5s' repeatCount='indefinite'/%3E%3C/circle%3E%3C/g%3E%3C/svg%3E")` } } }, "@layer daisyui.l1.l2": { ".loading-spinner": { "mask-image": `url("data:image/svg+xml,%3Csvg width='24' height='24' stroke='black' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cg transform-origin='center'%3E%3Ccircle cx='12' cy='12' r='9.5' fill='none' stroke-width='3' stroke-linecap='round'%3E%3CanimateTransform attributeName='transform' type='rotate' from='0 12 12' to='360 12 12' dur='8s' repeatCount='indefinite'/%3E%3Canimate attributeName='stroke-dasharray' values='0,150;42,150;42,150' keyTimes='0;0.475;1' dur='6s' repeatCount='indefinite'/%3E%3Canimate attributeName='stroke-dashoffset' values='0;-16;-59' keyTimes='0;0.475;1' dur='6s' repeatCount='indefinite'/%3E%3C/circle%3E%3C/g%3E%3C/svg%3E")` }, "@media (prefers-reduced-motion: no-preference)": [{ ".loading-spinner": { "mask-image": `url("data:image/svg+xml,%3Csvg width='24' height='24' stroke='black' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cg transform-origin='center'%3E%3Ccircle cx='12' cy='12' r='9.5' fill='none' stroke-width='3' stroke-linecap='round'%3E%3CanimateTransform attributeName='transform' type='rotate' from='0 12 12' to='360 12 12' dur='2s' repeatCount='indefinite'/%3E%3Canimate attributeName='stroke-dasharray' values='0,150;42,150;42,150' keyTimes='0;0.475;1' dur='1.5s' repeatCount='indefinite'/%3E%3Canimate attributeName='stroke-dashoffset' values='0;-16;-59' keyTimes='0;0.475;1' dur='1.5s' repeatCount='indefinite'/%3E%3C/circle%3E%3C/g%3E%3C/svg%3E")` } }, { ".loading-dots": { "mask-image": `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='4' cy='12' r='3'%3E%3Canimate attributeName='cy' values='12;6;12;12' keyTimes='0;0.286;0.571;1' dur='1.05s' repeatCount='indefinite' keySplines='.33,0,.66,.33;.33,.66,.66,1'/%3E%3C/circle%3E%3Ccircle cx='12' cy='12' r='3'%3E%3Canimate attributeName='cy' values='12;6;12;12' keyTimes='0;0.286;0.571;1' dur='1.05s' repeatCount='indefinite' keySplines='.33,0,.66,.33;.33,.66,.66,1' begin='0.1s'/%3E%3C/circle%3E%3Ccircle cx='20' cy='12' r='3'%3E%3Canimate attributeName='cy' values='12;6;12;12' keyTimes='0;0.286;0.571;1' dur='1.05s' repeatCount='indefinite' keySplines='.33,0,.66,.33;.33,.66,.66,1' begin='0.2s'/%3E%3C/circle%3E%3C/svg%3E")` } }, { ".loading-ring": { "mask-image": `url("data:image/svg+xml,%3Csvg width='44' height='44' viewBox='0 0 44 44' xmlns='http://www.w3.org/2000/svg' stroke='white'%3E%3Cg fill='none' fill-rule='evenodd' stroke-width='2'%3E%3Ccircle cx='22' cy='22' r='1'%3E%3Canimate attributeName='r' begin='0s' dur='1.8s' values='1;20' calcMode='spline' keyTimes='0;1' keySplines='0.165,0.84,0.44,1' repeatCount='indefinite'/%3E%3Canimate attributeName='stroke-opacity' begin='0s' dur='1.8s' values='1;0' calcMode='spline' keyTimes='0;1' keySplines='0.3,0.61,0.355,1' repeatCount='indefinite'/%3E%3C/circle%3E%3Ccircle cx='22' cy='22' r='1'%3E%3Canimate attributeName='r' begin='-0.9s' dur='1.8s' values='1;20' calcMode='spline' keyTimes='0;1' keySplines='0.165,0.84,0.44,1' repeatCount='indefinite'/%3E%3Canimate attributeName='stroke-opacity' begin='-0.9s' dur='1.8s' values='1;0' calcMode='spline' keyTimes='0;1' keySplines='0.3,0.61,0.355,1' repeatCount='indefinite'/%3E%3C/circle%3E%3C/g%3E%3C/svg%3E")` } }, { ".loading-ball": { "mask-image": `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cellipse cx='12' cy='5' rx='4' ry='4'%3E%3Canimate attributeName='cy' values='5;20;20.5;20;5' keyTimes='0;0.469;0.5;0.531;1' dur='.8s' repeatCount='indefinite' keySplines='.33,0,.66,.33;.33,.66,.66,1'/%3E%3Canimate attributeName='rx' values='4;4;4.8;4;4' keyTimes='0;0.469;0.5;0.531;1' dur='.8s' repeatCount='indefinite'/%3E%3Canimate attributeName='ry' values='4;4;3;4;4' keyTimes='0;0.469;0.5;0.531;1' dur='.8s' repeatCount='indefinite'/%3E%3C/ellipse%3E%3C/svg%3E")` } }, { ".loading-bars": { "mask-image": `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='1' y='1' width='6' height='22'%3E%3Canimate attributeName='y' values='1;5;1' keyTimes='0;0.938;1' dur='.8s' repeatCount='indefinite'/%3E%3Canimate attributeName='height' values='22;14;22' keyTimes='0;0.938;1' dur='.8s' repeatCount='indefinite'/%3E%3Canimate attributeName='opacity' values='1;0.2;1' keyTimes='0;0.938;1' dur='.8s' repeatCount='indefinite'/%3E%3C/rect%3E%3Crect x='9' y='1' width='6' height='22'%3E%3Canimate attributeName='y' values='1;5;1' keyTimes='0;0.938;1' dur='.8s' repeatCount='indefinite' begin='-0.65s'/%3E%3Canimate attributeName='height' values='22;14;22' keyTimes='0;0.938;1' dur='.8s' repeatCount='indefinite' begin='-0.65s'/%3E%3Canimate attributeName='opacity' values='1;0.2;1' keyTimes='0;0.938;1' dur='.8s' repeatCount='indefinite' begin='-0.65s'/%3E%3C/rect%3E%3Crect x='17' y='1' width='6' height='22'%3E%3Canimate attributeName='y' values='1;5;1' keyTimes='0;0.938;1' dur='.8s' repeatCount='indefinite' begin='-0.5s'/%3E%3Canimate attributeName='height' values='22;14;22' keyTimes='0;0.938;1' dur='.8s' repeatCount='indefinite' begin='-0.5s'/%3E%3Canimate attributeName='opacity' values='1;0.2;1' keyTimes='0;0.938;1' dur='.8s' repeatCount='indefinite' begin='-0.5s'/%3E%3C/rect%3E%3C/svg%3E")` } }, { ".loading-infinity": { "mask-image": `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' style='shape-rendering:auto;' width='200px' height='200px' viewBox='0 0 100 100' preserveAspectRatio='xMidYMid'%3E%3Cpath fill='none' stroke='black' stroke-width='10' stroke-dasharray='205.271 51.318' d='M24.3 30C11.4 30 5 43.3 5 50s6.4 20 19.3 20c19.3 0 32.1-40 51.4-40C88.6 30 95 43.3 95 50s-6.4 20-19.3 20C56.4 70 43.6 30 24.3 30z' stroke-linecap='round' style='transform:scale(0.8);transform-origin:50px 50px'%3E%3Canimate attributeName='stroke-dashoffset' repeatCount='indefinite' dur='2s' keyTimes='0;1' values='0;256.589'/%3E%3C/path%3E%3C/svg%3E")` } }], ".loading-dots": { "mask-image": `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='4' cy='12' r='3'%3E%3Canimate attributeName='cy' values='12;6;12;12' keyTimes='0;0.286;0.571;1' dur='3s' repeatCount='indefinite' keySplines='.33,0,.66,.33;.33,.66,.66,1'/%3E%3C/circle%3E%3Ccircle cx='12' cy='12' r='3'%3E%3Canimate attributeName='cy' values='12;6;12;12' keyTimes='0;0.286;0.571;1' dur='3s' repeatCount='indefinite' keySplines='.33,0,.66,.33;.33,.66,.66,1' begin='0.1s'/%3E%3C/circle%3E%3Ccircle cx='20' cy='12' r='3'%3E%3Canimate attributeName='cy' values='12;6;12;12' keyTimes='0;0.286;0.571;1' dur='3s' repeatCount='indefinite' keySplines='.33,0,.66,.33;.33,.66,.66,1' begin='0.2s'/%3E%3C/circle%3E%3C/svg%3E")` }, ".loading-ring": { "mask-image": `url("data:image/svg+xml,%3Csvg width='44' height='44' viewBox='0 0 44 44' xmlns='http://www.w3.org/2000/svg' stroke='white'%3E%3Cg fill='none' fill-rule='evenodd' stroke-width='2'%3E%3Ccircle cx='22' cy='22' r='1'%3E%3Canimate attributeName='r' begin='0s' dur='5.4s' values='1;20' calcMode='spline' keyTimes='0;1' keySplines='0.165,0.84,0.44,1' repeatCount='indefinite'/%3E%3Canimate attributeName='stroke-opacity' begin='0s' dur='5.4s' values='1;0' calcMode='spline' keyTimes='0;1' keySplines='0.3,0.61,0.355,1' repeatCount='indefinite'/%3E%3C/circle%3E%3Ccircle cx='22' cy='22' r='1'%3E%3Canimate attributeName='r' begin='-0.9s' dur='5.4s' values='1;20' calcMode='spline' keyTimes='0;1' keySplines='0.165,0.84,0.44,1' repeatCount='indefinite'/%3E%3Canimate attributeName='stroke-opacity' begin='-0.9s' dur='5.4s' values='1;0' calcMode='spline' keyTimes='0;1' keySplines='0.3,0.61,0.355,1' repeatCount='indefinite'/%3E%3C/circle%3E%3C/g%3E%3C/svg%3E")` }, ".loading-ball": { "mask-image": `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cellipse cx='12' cy='5' rx='4' ry='4'%3E%3Canimate attributeName='cy' values='5;20;20.5;20;5' keyTimes='0;0.469;0.5;0.531;1' dur='2s' repeatCount='indefinite' keySplines='.33,0,.66,.33;.33,.66,.66,1'/%3E%3Canimate attributeName='rx' values='4;4;4.8;4;4' keyTimes='0;0.469;0.5;0.531;1' dur='2s' repeatCount='indefinite'/%3E%3Canimate attributeName='ry' values='4;4;3;4;4' keyTimes='0;0.469;0.5;0.531;1' dur='2s' repeatCount='indefinite'/%3E%3C/ellipse%3E%3C/svg%3E")` }, ".loading-bars": { "mask-image": `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='1' y='1' width='6' height='22'%3E%3Canimate attributeName='y' values='1;5;1' keyTimes='0;0.938;1' dur='2.4s' repeatCount='indefinite'/%3E%3Canimate attributeName='height' values='22;14;22' keyTimes='0;0.938;1' dur='2.4s' repeatCount='indefinite'/%3E%3Canimate attributeName='opacity' values='1;0.2;1' keyTimes='0;0.938;1' dur='2.4s' repeatCount='indefinite'/%3E%3C/rect%3E%3Crect x='9' y='1' width='6' height='22'%3E%3Canimate attributeName='y' values='1;5;1' keyTimes='0;0.938;1' dur='2.4s' repeatCount='indefinite' begin='-0.65s'/%3E%3Canimate attributeName='height' values='22;14;22' keyTimes='0;0.938;1' dur='2.4s' repeatCount='indefinite' begin='-0.65s'/%3E%3Canimate attributeName='opacity' values='1;0.2;1' keyTimes='0;0.938;1' dur='2.4s' repeatCount='indefinite' begin='-0.65s'/%3E%3C/rect%3E%3Crect x='17' y='1' width='6' height='22'%3E%3Canimate attributeName='y' values='1;5;1' keyTimes='0;0.938;1' dur='2.4s' repeatCount='indefinite' begin='-0.5s'/%3E%3Canimate attributeName='height' values='22;14;22' keyTimes='0;0.938;1' dur='2.4s' repeatCount='indefinite' begin='-0.5s'/%3E%3Canimate attributeName='opacity' values='1;0.2;1' keyTimes='0;0.938;1' dur='2.4s' repeatCount='indefinite' begin='-0.5s'/%3E%3C/rect%3E%3C/svg%3E")` }, ".loading-infinity": { "mask-image": `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' style='shape-rendering:auto;' width='200px' height='200px' viewBox='0 0 100 100' preserveAspectRatio='xMidYMid'%3E%3Cpath fill='none' stroke='black' stroke-width='10' stroke-dasharray='205.271 51.318' d='M24.3 30C11.4 30 5 43.3 5 50s6.4 20 19.3 20c19.3 0 32.1-40 51.4-40C88.6 30 95 43.3 95 50s-6.4 20-19.3 20C56.4 70 43.6 30 24.3 30z' stroke-linecap='round' style='transform:scale(0.8);transform-origin:50px 50px'%3E%3Canimate attributeName='stroke-dashoffset' repeatCount='indefinite' dur='6s' keyTimes='0;1' values='0;256.589'/%3E%3C/path%3E%3C/svg%3E")` }, ".loading-xs": { "width": "calc(var(--size-selector, 0.25rem) * 4)" }, ".loading-sm": { "width": "calc(var(--size-selector, 0.25rem) * 5)" }, ".loading-md": { "width": "calc(var(--size-selector, 0.25rem) * 6)" }, ".loading-lg": { "width": "calc(var(--size-selector, 0.25rem) * 7)" }, ".loading-xl": { "width": "calc(var(--size-selector, 0.25rem) * 8)" } } };

  // vendor/package/components/loading/index.js
  var loading_default = ({ addComponents, prefix = "" }) => {
    const prefixedloading = addPrefix(object_default66, prefix);
    addComponents({ ...prefixedloading });
  };

  // vendor/package/components/dock/object.js
  var object_default67 = { "@layer daisyui.l1.l2.l3": { ".dock": { "position": "fixed", "right": "0px", "bottom": "0px", "left": "0px", "z-index": 1, "display": "flex", "width": "100%", "flex-direction": "row", "align-items": "center", "justify-content": "space-around", "background-color": "var(--color-base-100)", "padding": "calc(0.25rem * 2)", "color": "currentcolor", "border-top": "0.5px solid color-mix(in oklab, var(--color-base-content) 5%, #0000)", "height": ["4rem", "calc(4rem + env(safe-area-inset-bottom))"], "padding-bottom": "env(safe-area-inset-bottom)" }, ".dock > *:not(:where(script, style, template))": { "position": "relative", "margin-bottom": "calc(0.25rem * 2)", "display": "flex", "height": "100%", "max-width": "calc(0.25rem * 32)", "flex-shrink": 1, "flex-basis": "100%", "cursor": "pointer", "flex-direction": "column", "align-items": "center", "justify-content": "center", "gap": "1px", "border-radius": "var(--radius-box)", "background-color": "transparent", "transition": "opacity 0.2s ease-out", "@media (hover: hover)": { "&:hover": { "opacity": "80%" } }, '&[aria-disabled="true"], &[disabled]': { "&, &:hover": { "pointer-events": "none", "color": "color-mix(in oklab, var(--color-base-content) 10%, transparent)", "opacity": "100%" } }, ".dock-label": { "font-size": "0.6875rem" }, "&:after": { "content": '""', "position": "absolute", "height": "0.25rem", "width": "calc(0.25rem * 6)", "border-radius": "calc(infinity * 1px)", "background-color": "transparent", "bottom": "0.2rem", "border-top": "3px solid transparent", "transition": "background-color 0.1s ease-out, text-color 0.1s ease-out, width 0.1s ease-out" } } }, "@layer daisyui.l1.l2": { ".dock-active:after": { "width": "calc(0.25rem * 10)", "background-color": "currentcolor", "color": "currentcolor" }, ".dock-xs": { "height": ["3rem", "calc(3rem + env(safe-area-inset-bottom))"] }, ".dock-xs .dock-active:after": { "bottom": "-0.1rem" }, ".dock-xs .dock-label": { "font-size": "0.625rem" }, ".dock-sm": { "height": ["calc(0.25rem * 14)", "3.5rem", "calc(3.5rem + env(safe-area-inset-bottom))"] }, ".dock-sm .dock-active:after": { "bottom": "-0.1rem" }, ".dock-sm .dock-label": { "font-size": "0.625rem" }, ".dock-md": { "height": ["4rem", "calc(4rem + env(safe-area-inset-bottom))"] }, ".dock-md .dock-label": { "font-size": "0.6875rem" }, ".dock-lg": { "height": ["4.5rem", "calc(4.5rem + env(safe-area-inset-bottom))"] }, ".dock-lg .dock-active:after": { "bottom": "0.4rem" }, ".dock-lg .dock-label": { "font-size": "0.6875rem" }, ".dock-xl": { "height": ["5rem", "calc(5rem + env(safe-area-inset-bottom))"] }, ".dock-xl .dock-active:after": { "bottom": "0.4rem" }, ".dock-xl .dock-label": { "font-size": "0.75rem" } } };

  // vendor/package/components/dock/index.js
  var dock_default = ({ addComponents, prefix = "" }) => {
    const prefixeddock = addPrefix(object_default67, prefix);
    addComponents({ ...prefixeddock });
  };

  // vendor/package/components/tooltip/object.js
  var object_default68 = { "@layer daisyui.l1.l2.l3": { ".tooltip": { "position": "relative", "display": "inline-block", "--tt-bg": "var(--color-neutral)", "--tt-off": "calc(100% + 0.5rem)", "--tt-tail": "calc(100% + 1px + 0.25rem)", "--tt-tail-off": "0.5rem" }, ".tooltip > .tooltip-content, .tooltip[data-tip]:before": { "position": "absolute", "max-width": "20rem", "border-radius": "var(--radius-field)", "padding-inline": "calc(0.25rem * 2)", "padding-block": "0.25rem", "text-align": "center", "white-space": "normal", "color": "var(--color-neutral-content)", "opacity": "0%", "font-size": "0.875rem", "font-weight": 400, "line-height": 1.25, "background-color": "var(--tt-bg)", "width": "max-content", "pointer-events": "none", "z-index": 2, "--tw-content": "attr(data-tip)", "content": "var(--tw-content)", "transform": "translateX(var(--tt-trans, -50%)) translateY(var(--tt-pos, 0.25rem))", "inset": "auto auto var(--tt-off) 50%" }, ".tooltip:after": { "opacity": "0%", "background-color": "var(--tt-bg)", "content": '""', "pointer-events": "none", "width": "0.625rem", "height": "0.25rem", "display": "block", "position": "absolute", "mask-repeat": "no-repeat", "mask-position": "-1px 0", "--mask-tooltip": `url("data:image/svg+xml,%3Csvg width='10' height='4' viewBox='0 0 8 4' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0.500009 1C3.5 1 3.00001 4 5.00001 4C7 4 6.5 1 9.5 1C10 1 10 0.499897 10 0H0C-1.99338e-08 0.5 0 1 0.500009 1Z' fill='black'/%3E%3C/svg%3E%0A")`, "mask-image": "var(--mask-tooltip)", "transform": "translateX(var(--tt-trans, -50%)) translateY(var(--tt-pos, 0.25rem))", "inset": "auto auto var(--tt-tail) 50%" }, "@media (prefers-reduced-motion: no-preference)": { ".tooltip > .tooltip-content, .tooltip[data-tip]:before, .tooltip:after": { "transition": "opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1) 75ms, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) 75ms" } }, ':is(.tooltip:is([data-tip]:not([data-tip=""]), :has(.tooltip-content:not(:empty))).tooltip-open, .tooltip:is([data-tip]:not([data-tip=""]), :has(.tooltip-content:not(:empty))):hover, .tooltip:is([data-tip]:not([data-tip=""]), :has(.tooltip-content:not(:empty))):has(:focus-visible)) > .tooltip-content, :is(.tooltip:is([data-tip]:not([data-tip=""]), :has(.tooltip-content:not(:empty))).tooltip-open, .tooltip:is([data-tip]:not([data-tip=""]), :has(.tooltip-content:not(:empty))):hover, .tooltip:is([data-tip]:not([data-tip=""]), :has(.tooltip-content:not(:empty))):has(:focus-visible))[data-tip]:before, :is(.tooltip:is([data-tip]:not([data-tip=""]), :has(.tooltip-content:not(:empty))).tooltip-open, .tooltip:is([data-tip]:not([data-tip=""]), :has(.tooltip-content:not(:empty))):hover, .tooltip:is([data-tip]:not([data-tip=""]), :has(.tooltip-content:not(:empty))):has(:focus-visible)):after': { "opacity": "100%", "--tt-pos": "0rem", "@media (prefers-reduced-motion: no-preference)": { "transition": "opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1) 0s, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) 0s" } } }, "@layer daisyui.l1.l2": { ".tooltip-top > .tooltip-content, .tooltip-top[data-tip]:before": { "transform": "translateX(var(--tt-trans, -50%)) translateY(var(--tt-pos, 0.25rem))", "inset": "auto auto var(--tt-off) 50%" }, ".tooltip-top:after": { "transform": "translateX(var(--tt-trans, -50%)) translateY(var(--tt-pos, 0.25rem))", "inset": "auto auto var(--tt-tail) 50%" }, ".tooltip-bottom > .tooltip-content, .tooltip-bottom[data-tip]:before": { "transform": "translateX(var(--tt-trans, -50%)) translateY(var(--tt-pos, -0.25rem))", "inset": "var(--tt-off) auto auto 50%" }, ".tooltip-bottom:after": { "transform": "translateX(var(--tt-trans, -50%)) translateY(var(--tt-pos, -0.25rem)) rotate(180deg)", "inset": "var(--tt-tail) auto auto 50%" }, ".tooltip-start": { "--tt-trans": "0", "--tt-inset": "0 auto", "--tt-tail-inset": "var(--tt-tail-off) auto" }, ".tooltip-start > .tooltip-content, .tooltip-start[data-tip]:before": { "left": "auto", "right": "auto", "inset-inline": "0 auto" }, ".tooltip-start:after": { "left": "auto", "right": "auto", "inset-inline": "var(--tt-tail-off) auto" }, ".tooltip-center": { "--tt-trans": "-50%", "--tt-inset": "50% auto", "--tt-tail-inset": "50% auto" }, ".tooltip-center > .tooltip-content, .tooltip-center[data-tip]:before": { "inset-inline": "auto", "left": "50%", "right": "auto" }, ".tooltip-center:after": { "inset-inline": "auto", "left": "50%", "right": "auto" }, ".tooltip-end": { "--tt-trans": "0", "--tt-inset": "auto 0", "--tt-tail-inset": "auto var(--tt-tail-off)" }, ".tooltip-end > .tooltip-content, .tooltip-end[data-tip]:before": { "left": "auto", "right": "auto", "inset-inline": "auto 0" }, ".tooltip-end:after": { "left": "auto", "right": "auto", "inset-inline": "auto var(--tt-tail-off)" }, ".tooltip-left > .tooltip-content, .tooltip-left[data-tip]:before": { "transform": "translateX(calc(var(--tt-pos, 0.25rem) - 0.25rem)) translateY(var(--tt-trans, -50%))", "left": "auto", "right": "var(--tt-off)", "inset-block": "var(--tt-inset, 50% auto)" }, ".tooltip-left:after": { "transform": "translateX(var(--tt-pos, 0.25rem)) translateY(var(--tt-trans, -50%)) rotate(-90deg)", "left": "auto", "right": "calc(var(--tt-tail) + 1px)", "inset-block": "var(--tt-tail-inset, 50% auto)" }, ".tooltip-right > .tooltip-content, .tooltip-right[data-tip]:before": { "transform": "translateX(calc(var(--tt-pos, -0.25rem) + 0.25rem)) translateY(var(--tt-trans, -50%))", "left": "var(--tt-off)", "right": "auto", "inset-block": "var(--tt-inset, 50% auto)" }, ".tooltip-right:after": { "transform": "translateX(var(--tt-pos, -0.25rem)) translateY(var(--tt-trans, -50%)) rotate(90deg)", "left": "calc(var(--tt-tail) + 1px)", "right": "auto", "inset-block": "var(--tt-tail-inset, 50% auto)" }, ".tooltip-primary": { "--tt-bg": "var(--color-primary)" }, ".tooltip-primary > .tooltip-content, .tooltip-primary[data-tip]:before": { "color": "var(--color-primary-content)" }, ".tooltip-secondary": { "--tt-bg": "var(--color-secondary)" }, ".tooltip-secondary > .tooltip-content, .tooltip-secondary[data-tip]:before": { "color": "var(--color-secondary-content)" }, ".tooltip-accent": { "--tt-bg": "var(--color-accent)" }, ".tooltip-accent > .tooltip-content, .tooltip-accent[data-tip]:before": { "color": "var(--color-accent-content)" }, ".tooltip-info": { "--tt-bg": "var(--color-info)" }, ".tooltip-info > .tooltip-content, .tooltip-info[data-tip]:before": { "color": "var(--color-info-content)" }, ".tooltip-success": { "--tt-bg": "var(--color-success)" }, ".tooltip-success > .tooltip-content, .tooltip-success[data-tip]:before": { "color": "var(--color-success-content)" }, ".tooltip-warning": { "--tt-bg": "var(--color-warning)" }, ".tooltip-warning > .tooltip-content, .tooltip-warning[data-tip]:before": { "color": "var(--color-warning-content)" }, ".tooltip-error": { "--tt-bg": "var(--color-error)" }, ".tooltip-error > .tooltip-content, .tooltip-error[data-tip]:before": { "color": "var(--color-error-content)" } } };

  // vendor/package/components/tooltip/index.js
  var tooltip_default = ({ addComponents, prefix = "" }) => {
    const prefixedtooltip = addPrefix(object_default68, prefix);
    addComponents({ ...prefixedtooltip });
  };

  // vendor/package/utilities/join/object.js
  var object_default69 = { ".join": { "display": "inline-flex", "align-items": "stretch", "--join-ss": "0", "--join-se": "0", "--join-es": "0", "--join-ee": "0", "--join-ml": "0", "--join-mt": "0", "--join-v": "0", "--join-h": "1", "@scope (&)": { "> :where(:focus, :has(:focus))": { "z-index": 2 }, "@media (hover: hover)": { "> :where(.btn:hover, :has(.btn:hover))": { "z-index": 1 } }, ":where(:scope > :first-child)": { "--join-ss": "var(--radius-field)", "--join-se": "calc(var(--radius-field) * var(--join-v))", "--join-es": "calc(var(--radius-field) * var(--join-h))", "--join-ee": "0" }, ":where(:scope > :last-child)": { "--join-ss": "0", "--join-se": "calc(var(--radius-field) * var(--join-h))", "--join-es": "calc(var(--radius-field) * var(--join-v))", "--join-ee": "var(--radius-field)" }, ":where(:scope > :only-child)": { "--join-ss": "var(--radius-field)", "--join-se": "var(--radius-field)", "--join-es": "var(--radius-field)", "--join-ee": "var(--radius-field)" }, ":where(:scope > :not(:first-child))": { "--join-ml": "calc(var(--border, 1px) * -1 * var(--join-h))", "--join-mt": "calc(var(--border, 1px) * -1 * var(--join-v))" } } }, ".join-item": { "@layer daisyui.l1.l2.l3.l4": { "> *": { "--join-ss": "initial", "--join-se": "initial", "--join-es": "initial", "--join-ee": "initial" } }, "border-style": "solid", "border-width": "var(--border, 1px)", "border-start-start-radius": "var(--join-ss)", "border-start-end-radius": "var(--join-se)", "border-end-start-radius": "var(--join-es)", "border-end-end-radius": "var(--join-ee)", "&:not(:disabled, [disabled], .btn-disabled)": { "margin-inline-start": "var(--join-ml, 0)", "margin-block-start": "var(--join-mt, 0)" }, "&:is(:disabled, [disabled], .btn-disabled)": { "border-width": "var(--border, 1px)", "border-inline-end-width": "calc(var(--border, 1px) * var(--join-v))", "border-block-end-width": "calc(var(--border, 1px) * var(--join-h))" } }, ".join-vertical": { "flex-direction": "column", "--join-v": "1", "--join-h": "0" }, ".join-horizontal": { "flex-direction": "row", "--join-v": "0", "--join-h": "1" } };

  // vendor/package/utilities/join/index.js
  var join_default = ({ addUtilities, prefix = "" }) => {
    const prefixedjoin = addPrefix(object_default69, prefix);
    addUtilities({ ...prefixedjoin });
  };

  // vendor/package/utilities/glass/object.js
  var object_default70 = { ".glass": { "border": "none", "backdrop-filter": "blur(var(--glass-blur, 40px))", "background-color": "#0000", "background-image": "linear-gradient( 135deg, oklch(100% 0 0 / var(--glass-opacity, 30%)) 0%, oklch(0% 0 0 / 0%) 100% ), linear-gradient( var(--glass-reflect-degree, 100deg), oklch(100% 0 0 / var(--glass-reflect-opacity, 5%)) 25%, oklch(0% 0 0 / 0%) 25% )", "box-shadow": "0 0 0 1px oklch(100% 0 0 / var(--glass-border-opacity, 20%)) inset, 0 0 0 2px oklch(0% 0 0 / 5%)", "text-shadow": "0 1px oklch(0% 0 0 / var(--glass-text-shadow-opacity, 5%))" } };

  // vendor/package/utilities/glass/index.js
  var glass_default = ({ addUtilities, prefix = "" }) => {
    const prefixedglass = addPrefix(object_default70, prefix);
    addUtilities({ ...prefixedglass });
  };

  // vendor/package/utilities/typography/object.js
  var object_default71 = { ":root .prose": { "--tw-prose-body": "color-mix(in oklab, var(--color-base-content) 80%, #0000)", "--tw-prose-headings": "var(--color-base-content)", "--tw-prose-lead": "var(--color-base-content)", "--tw-prose-links": "var(--color-base-content)", "--tw-prose-bold": "var(--color-base-content)", "--tw-prose-counters": "var(--color-base-content)", "--tw-prose-bullets": "color-mix(in oklab, var(--color-base-content) 50%, #0000)", "--tw-prose-hr": "color-mix(in oklab, var(--color-base-content) 20%, #0000)", "--tw-prose-quotes": "var(--color-base-content)", "--tw-prose-quote-borders": "color-mix(in oklab, var(--color-base-content) 20%, #0000)", "--tw-prose-captions": "color-mix(in oklab, var(--color-base-content) 50%, #0000)", "--tw-prose-code": "var(--color-base-content)", "--tw-prose-pre-code": "var(--color-neutral-content)", "--tw-prose-pre-bg": "var(--color-neutral)", "--tw-prose-th-borders": "color-mix(in oklab, var(--color-base-content) 50%, #0000)", "--tw-prose-td-borders": "color-mix(in oklab, var(--color-base-content) 20%, #0000)", "--tw-prose-kbd": "color-mix(in oklab, var(--color-base-content) 80%, #0000)", ":where(code):not(pre > code)": { "background-color": "var(--color-base-200)", "border-radius": "var(--radius-selector)", "border": "var(--border) solid var(--color-base-300)", "padding-inline": "0.5em", "padding-block": "0.2em", "font-weight": "inherit", "&:before, &:after": { "display": "none" } } } };

  // vendor/package/utilities/typography/index.js
  var typography_default = ({ addUtilities, prefix = "" }) => {
    const prefixedtypography = addPrefix(object_default71, prefix);
    addUtilities({ ...prefixedtypography });
  };

  // vendor/package/utilities/radius/object.js
  var object_default72 = { ".rounded-box": { "border-radius": "var(--radius-box)" }, ".rounded-field": { "border-radius": "var(--radius-field)" }, ".rounded-selector": { "border-radius": "var(--radius-selector)" }, ".rounded-t-box": { "border-top-left-radius": "var(--radius-box)", "border-top-right-radius": "var(--radius-box)" }, ".rounded-b-box": { "border-bottom-left-radius": "var(--radius-box)", "border-bottom-right-radius": "var(--radius-box)" }, ".rounded-l-box": { "border-top-left-radius": "var(--radius-box)", "border-bottom-left-radius": "var(--radius-box)" }, ".rounded-r-box": { "border-top-right-radius": "var(--radius-box)", "border-bottom-right-radius": "var(--radius-box)" }, ".rounded-tl-box": { "border-top-left-radius": "var(--radius-box)" }, ".rounded-tr-box": { "border-top-right-radius": "var(--radius-box)" }, ".rounded-br-box": { "border-bottom-right-radius": "var(--radius-box)" }, ".rounded-bl-box": { "border-bottom-left-radius": "var(--radius-box)" }, ".rounded-t-field": { "border-top-left-radius": "var(--radius-field)", "border-top-right-radius": "var(--radius-field)" }, ".rounded-b-field": { "border-bottom-left-radius": "var(--radius-field)", "border-bottom-right-radius": "var(--radius-field)" }, ".rounded-l-field": { "border-top-left-radius": "var(--radius-field)", "border-bottom-left-radius": "var(--radius-field)" }, ".rounded-r-field": { "border-top-right-radius": "var(--radius-field)", "border-bottom-right-radius": "var(--radius-field)" }, ".rounded-tl-field": { "border-top-left-radius": "var(--radius-field)" }, ".rounded-tr-field": { "border-top-right-radius": "var(--radius-field)" }, ".rounded-br-field": { "border-bottom-right-radius": "var(--radius-field)" }, ".rounded-bl-field": { "border-bottom-left-radius": "var(--radius-field)" }, ".rounded-t-selector": { "border-top-left-radius": "var(--radius-selector)", "border-top-right-radius": "var(--radius-selector)" }, ".rounded-b-selector": { "border-bottom-left-radius": "var(--radius-selector)", "border-bottom-right-radius": "var(--radius-selector)" }, ".rounded-l-selector": { "border-top-left-radius": "var(--radius-selector)", "border-bottom-left-radius": "var(--radius-selector)" }, ".rounded-r-selector": { "border-top-right-radius": "var(--radius-selector)", "border-bottom-right-radius": "var(--radius-selector)" }, ".rounded-tl-selector": { "border-top-left-radius": "var(--radius-selector)" }, ".rounded-tr-selector": { "border-top-right-radius": "var(--radius-selector)" }, ".rounded-br-selector": { "border-bottom-right-radius": "var(--radius-selector)" }, ".rounded-bl-selector": { "border-bottom-left-radius": "var(--radius-selector)" } };

  // vendor/package/utilities/radius/index.js
  var radius_default = ({ addUtilities, prefix = "" }) => {
    const prefixedradius = addPrefix(object_default72, prefix);
    addUtilities({ ...prefixedradius });
  };

  // vendor/package/imports.js
  var base = { rootscrollgutter: rootscrollgutter_default, svg: svg_default, scrollbar: scrollbar_default, properties: properties_default, rootcolor: rootcolor_default, rootscrolllock: rootscrolllock_default };
  var components = { skeleton: skeleton_default, mask: mask_default, status: status_default, checkbox: checkbox_default, radio: radio_default, collapse: collapse_default, fieldset: fieldset_default, diff: diff_default, hover3d: hover3d_default, textrotate: textrotate_default, kbd: kbd_default, avatar: avatar_default, rating: rating_default, stat: stat_default, dropdown: dropdown_default, filter: filter_default, megamenu: megamenu_default, toggle: toggle_default, swap: swap_default, link: link_default, hovergallery: hovergallery_default, select: select_default, badge: badge_default, mockup: mockup_default, calendar: calendar_default, divider: divider_default, modal: modal_default, steps: steps_default, list: list_default, breadcrumbs: breadcrumbs_default, chat: chat_default, radialprogress: radialprogress_default, aura: aura_default, range: range_default, stack: stack_default, fileinput: fileinput_default, carousel: carousel_default, alert: alert_default, drawer: drawer_default, fab: fab_default, input: input_default, toast: toast_default, menu: menu_default, tab: tab_default, navbar: navbar_default, countdown: countdown_default, textarea: textarea_default, card: card_default, label: label_default, indicator: indicator_default, progress: progress_default, otp: otp_default, table: table_default, hero: hero_default, button: button_default, validator: validator_default, timeline: timeline_default, footer: footer_default, loading: loading_default, dock: dock_default, tooltip: tooltip_default };
  var utilities = { join: join_default, glass: glass_default, typography: typography_default, radius: radius_default };

  // vendor/package/index.js
  var version2 = "5.7.37";
  var package_default = plugin.withOptions(
    (options) => {
      return ({ addBase, addComponents, addUtilities, addVariant }) => {
        const {
          include,
          exclude,
          prefix = ""
        } = pluginOptionsHandler(options, addBase, object_default, version2);
        const shouldIncludeItem = (name) => {
          if (include && exclude) {
            return include.includes(name) && !exclude.includes(name);
          }
          if (include) {
            return include.includes(name);
          }
          if (exclude) {
            return !exclude.includes(name);
          }
          return true;
        };
        Object.entries(base).forEach(([name, item]) => {
          if (!shouldIncludeItem(name)) return;
          item({ addBase, prefix });
        });
        Object.entries(components).forEach(([name, item]) => {
          if (!shouldIncludeItem(name)) return;
          item({
            addComponents: (styles) => addComponents(nestCssLayers(styles)),
            prefix
          });
        });
        Object.entries(utilities).forEach(([name, item]) => {
          if (!shouldIncludeItem(name)) return;
          item({
            addUtilities: (styles) => addUtilities(nestCssLayers(styles)),
            prefix
          });
        });
        addVariant(
          `${prefix}is-drawer-close`,
          `&:where(.${prefix}drawer-toggle:not(:checked) ~ .${prefix}drawer-side, .${prefix}drawer-toggle:not(:checked) ~ .${prefix}drawer-side *)`
        );
        addVariant(
          `${prefix}is-drawer-open`,
          `&:where(.${prefix}drawer-toggle:checked ~ .${prefix}drawer-side, .${prefix}drawer-toggle:checked ~ .${prefix}drawer-side *)`
        );
      };
    },
    () => ({
      theme: {
        extend: variables_default
      }
    })
  );

  // driver-src/driver.js
  globalThis.__tw_log = [];
  function __tw_fmtArg(a) {
    if (typeof a === "string") return a;
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  }
  {
    const orig = globalThis.console;
    const make = (level) => (...args) => {
      const line = "[" + level + "] " + args.map(__tw_fmtArg).join(" ");
      globalThis.__tw_log.push(line);
      if (orig && typeof orig[level] === "function") {
        orig[level](...args);
      }
    };
    globalThis.console = {
      log: make("log"),
      warn: make("warn"),
      error: make("error"),
      info: make("info"),
      debug: make("debug"),
      trace: make("trace")
    };
  }
  if (typeof globalThis.structuredClone !== "function") {
    globalThis.structuredClone = function structuredClone2(value2) {
      const seen = /* @__PURE__ */ new Map();
      function clone(v) {
        if (v === null || typeof v !== "object") return v;
        if (seen.has(v)) return seen.get(v);
        if (v instanceof Date) return new Date(v.getTime());
        if (v instanceof RegExp) return new RegExp(v.source, v.flags);
        if (Array.isArray(v)) {
          const c2 = [];
          seen.set(v, c2);
          for (const item of v) c2.push(clone(item));
          return c2;
        }
        const c = Object.create(Object.getPrototypeOf(v));
        seen.set(v, c);
        for (const k of Object.keys(v)) c[k] = clone(v[k]);
        return c;
      }
      return clone(value2);
    };
  }
  function joinPath(base2, rel) {
    const parts = (base2 + "/" + rel).split("/");
    const out = [];
    for (const part of parts) {
      if (part === "" || part === ".") continue;
      if (part === "..") out.pop();
      else out.push(part);
    }
    return "/" + out.join("/");
  }
  async function build(inputCss, candidatesJson, tailwindCssText, twCssDir) {
    const candidates = JSON.parse(candidatesJson);
    async function loadModule(id, base2, resourceHint) {
      if (id === "daisyui") {
        return { path: "daisyui", base: "", module: package_default };
      }
      throw new Error("[TwDriver] cannot load module: " + id + " (hint: " + resourceHint + ")");
    }
    async function loadStylesheet(id, base2) {
      if (id === "tailwindcss" || id === "tailwindcss/index.css") {
        return { path: "tailwindcss/index.css", base: twCssDir, content: tailwindCssText };
      }
      if (id.startsWith("./") || id.startsWith("../")) {
        const abs = joinPath(base2, id);
        const content = globalThis.__tw_read(abs);
        return { path: abs, base: abs.slice(0, abs.lastIndexOf("/")), content };
      }
      throw new Error("[TwDriver] cannot load stylesheet: " + id + " (base: " + base2 + ")");
    }
    const compiler = await compile(inputCss, { base: "/", loadModule, loadStylesheet });
    return compiler.build(candidates);
  }
  globalThis.TwDriver = { build };
})();
