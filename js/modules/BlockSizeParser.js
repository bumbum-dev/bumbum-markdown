/**
 * BlockSizeParser Module
 * Pure string-parsing of resize state for code/Mermaid/math/table blocks.
 */

// Reasonable manual scale bounds
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 3.0;

// Mirrors Renderer.extractMermaidBlocks' fence pattern.
const FENCE_REGEX = /```([^\n`]*)\n([\s\S]*?)```/g;

// Display math only - inline $...$ isn't a block-level "thing to resize".
const MATH_REGEX = /\$\$([\s\S]*?)\$\$/g;

// A GFM table row: any non-blank line containing a pipe. 
const TABLE_ROW_REGEX = /\|/;

// A table's separator row: cells of dashes only.
const TABLE_SEPARATOR_REGEX = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

// Matches, starting from a block's own closing delimiter
const TRAILING_COMMENT_REGEX = /^([ \t]*\r?\n)([ \t]*)(<!--\s*size:\s*(\d+(?:\.\d+)?)%\s*-->)(?:[ \t]*(?:\r?\n|$))/;

/**
 * Look for a `<!-- size: N% -->` comment on the line right after a block
 * ending at `blockEnd`.
 * @param {string} markdown
 * @param {number} blockEnd - Offset just after the block's closing delimiter
 * @returns {{scale: number|null, commentStart: number|null, commentEnd: number|null}}
 */
function findTrailingSize(markdown, blockEnd) {
    const after = markdown.slice(blockEnd);
    const m = after.match(TRAILING_COMMENT_REGEX);
    if (!m) {
        return { scale: null, commentStart: null, commentEnd: null };
    }

    const commentStart = blockEnd + m[1].length + m[2].length;
    const commentEnd = commentStart + m[3].length;
    const rawScale = parseFloat(m[4]) / 100;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));

    return { scale, commentStart, commentEnd };
}

/**
 * Scan raw markdown for every GFM table (header row + separator row +
 * zero or more data rows, ending at the first non-table-row line), in
 * document order. Line-based rather than one regex: a table's row count
 * is unbounded, and the header/separator pairing needs real state to spot
 * reliably (mirrors how markdown-it's own table rule works, not a coincidence
 * - `token.map`/`data-line-start` on the rendered `<table>` uses the exact
 * same header+separator+rows shape as its own identity marker).
 * @param {string} markdown
 * @returns {Array<{type: 'table', blockStart: number, blockEnd: number}>}
 */
function findTableMatches(markdown) {
    const lines = markdown.split('\n');
    const lineOffsets = [];
    let offset = 0;
    for (const line of lines) {
        lineOffsets.push(offset);
        offset += line.length + 1;
    }

    const matches = [];
    let i = 0;
    while (i < lines.length - 1) {
        const isHeaderCandidate = TABLE_ROW_REGEX.test(lines[i]) && lines[i].trim() !== '';
        if (isHeaderCandidate && TABLE_SEPARATOR_REGEX.test(lines[i + 1])) {
            let j = i + 2;
            while (j < lines.length && TABLE_ROW_REGEX.test(lines[j]) && lines[j].trim() !== '') {
                j++;
            }
            const lastLine = j - 1;
            matches.push({
                type: 'table',
                blockStart: lineOffsets[i],
                blockEnd: lineOffsets[lastLine] + lines[lastLine].length
            });
            i = j;
        } else {
            i++;
        }
    }

    return matches;
}

/**
 * Scan raw markdown for every resizable block (fenced code, ```mermaid,
 * $$ math, tables), in document order, and whatever size comment follows
 * each.
 * @param {string} markdown
 * @returns {Array<{type: 'code'|'mermaid'|'math'|'table', scale: number|null, blockEnd: number, commentStart: number|null, commentEnd: number|null}>}
 */
export function extractBlockSizes(markdown) {
    if (!markdown) return [];

    const fenceMatches = [];
    FENCE_REGEX.lastIndex = 0;
    let m;
    while ((m = FENCE_REGEX.exec(markdown)) !== null) {
        const blockStart = m.index;
        const blockEnd = m.index + m[0].length;
        const lang = m[1].trim().toLowerCase();
        fenceMatches.push({
            type: lang === 'mermaid' ? 'mermaid' : 'code',
            blockStart,
            blockEnd
        });
        // Non-greedy match already prevents runaway spans, but guard
        // against a zero-length match looping forever regardless.
        if (m.index === FENCE_REGEX.lastIndex) FENCE_REGEX.lastIndex++;
    }

    const mathMatches = [];
    MATH_REGEX.lastIndex = 0;
    while ((m = MATH_REGEX.exec(markdown)) !== null) {
        const blockStart = m.index;
        const blockEnd = m.index + m[0].length;
        // Discard a $$...$$ that's really just example text shown inside a
        // fenced code block (e.g. documentation demonstrating this app's
        // own math syntax) - counting it here would desync every later
        // block's index against the rendered DOM.
        const insideFence = fenceMatches.some(f => blockStart >= f.blockStart && blockStart < f.blockEnd);
        if (!insideFence) {
            mathMatches.push({ type: 'math', blockStart, blockEnd });
        }
        if (m.index === MATH_REGEX.lastIndex) MATH_REGEX.lastIndex++;
    }

    const tableMatches = findTableMatches(markdown).filter(t =>
        !fenceMatches.some(f => t.blockStart >= f.blockStart && t.blockStart < f.blockEnd)
    );

    const all = [...fenceMatches, ...mathMatches, ...tableMatches].sort((a, b) => a.blockStart - b.blockStart);

    return all.map(({ type, blockEnd }) => {
        const { scale, commentStart, commentEnd } = findTrailingSize(markdown, blockEnd);
        return { type, scale, blockEnd, commentStart, commentEnd };
    });
}
