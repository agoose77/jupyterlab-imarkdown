import MarkdownIt from 'markdown-it';

export const EXPR_CLASS = 'eval-expr';

export interface IOptions {
  openDelim?: string;
  closeDelim?: string;
}

export function expressionPlugin(md: MarkdownIt, options: IOptions): any {
  const openDelim = options?.openDelim ?? '{{';
  const closeDelim = options?.closeDelim ?? '}}';

  function tokenize(state: any, silent: any) {
    // Check we start with the correct markers
    let pos = state.pos;

    // For performance, just check first character
    if (state.src[pos] !== openDelim[0]) {
      return false;
    }

    // Does the full substring match?
    if (state.src.slice(pos, pos + openDelim.length) !== openDelim) {
      return false;
    }
    pos += openDelim.length;

    // First index _after_ {{
    const startPos = pos;

    // Find end marker }}
    let stopPos = -1;
    while (stopPos === -1) {
      // Find first character of end marker
      pos = state.src.indexOf(closeDelim[0], pos);
      // Didn't find character
      if (pos === -1) {
        return false;
      }

      // If subsequent tokens don't match, just advance by one token!
      if (state.src.slice(pos, pos + closeDelim.length) !== closeDelim) {
        pos++;
        continue;
      }

      stopPos = pos;
      pos += closeDelim.length;
    }

    // Read tokens inside of the bracket
    const expression = state.src.slice(startPos, stopPos);
    state.pos = pos;

    const exprToken = state.push('expr', 'input', 0);
    exprToken.attrSet('type', 'hidden');
    exprToken.attrSet('class', EXPR_CLASS);
    exprToken.attrSet('value', expression);

    return true;
  }

  md.inline.ruler.after('emphasis', 'expr', tokenize);
}
