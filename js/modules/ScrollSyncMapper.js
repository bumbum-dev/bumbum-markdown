/**
 * ScrollSyncMapper Module
 * Maps editor line numbers to preview DOM elements for accurate content-aware scroll synchronization
 */

export class ScrollSyncMapper {
    constructor(editorElement, previewElement) {
        this.editor = editorElement;
        this.preview = previewElement;
        this.map = null;
        this.lastBuildTime = 0;
    }

    /**
     * Build complete bidirectional content mapping
     * @returns {Object} Content map with editor and preview mappings
     */
    buildMap() {
        const startTime = performance.now();
        
        const editorContent = this.editor.value;
        const lines = editorContent.split('\n');
        
        // Map editor lines to character positions
        const editorMap = this.buildEditorLineMap(lines);
        
        // Map preview elements to line numbers
        const previewMap = this.buildPreviewElementMap();

        // Content anchors drive the actual scroll interpolation
        const anchors = this.buildAnchors(editorMap, previewMap);

        this.map = {
            editor: editorMap,
            preview: previewMap,
            anchors: anchors,
            totalLines: lines.length
        };

        const buildTime = performance.now() - startTime;
        this.lastBuildTime = buildTime;

        return this.map;
    }

    /**
     * Build editor line mapping (line number → character positions)
     * @param {Array<string>} lines - Editor content split by lines
     * @returns {Array<Object>} Line mapping data
     */
    buildEditorLineMap(lines) {
        let charPos = 0;
        
        return lines.map((line, index) => {
            const lineData = {
                lineNumber: index + 1,
                startPos: charPos,
                endPos: charPos + line.length,
                text: line,
                length: line.length
            };
            
            charPos = lineData.endPos + 1; // +1 for newline character
            
            return lineData;
        });
    }

    /**
     * Build preview element mapping (DOM elements → line numbers)
     * @returns {Array<Object>} Preview element mapping data
     */
    buildPreviewElementMap() {
        const elements = this.getContentRoots()
            .flatMap(root => Array.from(root.querySelectorAll('[data-line-start]')));

        return elements.map(el => {
            const startLine = parseInt(el.dataset.lineStart) || 0;
            const endLine = parseInt(el.dataset.lineEnd) || startLine;
            const { top, height } = this.getRelativePosition(el);

            return {
                element: el,
                startLine: startLine,
                endLine: endLine,
                offsetTop: top,
                offsetHeight: height,
                tag: el.tagName.toLowerCase()
            };
        }).filter(item => item.startLine > 0); // Filter out invalid mappings
    }

    /**
     * Content roots to search for [data-line-start] elements: the preview
     * container itself, plus the document of any same-origin <iframe>
     * nested inside it.
     * @returns {Array<Document|HTMLElement>}
     */
    getContentRoots() {
        const roots = [this.preview];

        const iframes = this.preview.querySelectorAll('iframe');
        for (const frame of iframes) {
            try {
                if (frame.contentDocument && frame.contentDocument.body) {
                    roots.push(frame.contentDocument.body);
                }
            } catch (e) {
                // Cross-origin iframe - inaccessible, skip
            }
        }

        return roots;
    }

    /**
     * @param {HTMLElement} el
     * @returns {{top: number, height: number}}
     */
    getRelativePosition(el) {
        const containerRect = this.preview.getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        let top = rect.top;
        let height = rect.height;
        let doc = el.ownerDocument;

        while (doc && doc !== this.preview.ownerDocument) {
            const frameEl = doc.defaultView && doc.defaultView.frameElement;
            if (!frameEl) break;

            const frameRect = frameEl.getBoundingClientRect();
            const scale = frameEl.offsetWidth ? frameRect.width / frameEl.offsetWidth : 1;

            top = frameRect.top + (top * scale);
            height = height * scale;
            doc = frameEl.ownerDocument;
        }

        return {
            top: this.preview.scrollTop + (top - containerRect.top),
            height: height
        };
    }

    /**
     * Build content anchors
     * @param {Array<Object>} editorLineMap - from buildEditorLineMap()
     * @param {Array<Object>} previewMap - from buildPreviewElementMap()
     * @returns {Array<{startLine: number, editorTop: number, previewTop: number}>}
     */
    buildAnchors(editorLineMap, previewMap) {
        if (previewMap.length === 0) return [];

        const byLine = new Map();
        for (const item of previewMap) {
            const existing = byLine.get(item.startLine);
            if (!existing || item.offsetTop < existing.offsetTop) {
                byLine.set(item.startLine, item);
            }
        }

        const sorted = Array.from(byLine.values()).sort((a, b) => a.startLine - b.startLine);
        const editorTops = this.measureEditorLineTops(sorted.map(item => item.startLine), editorLineMap);

        return sorted.map((item, index) => ({
            startLine: item.startLine,
            editorTop: editorTops[index],
            previewTop: item.offsetTop
        }));
    }

    /**
     * Measure the real pixel Y of each given (ascending) line number inside
     * the editor textarea
     * @param {Array<number>} lineNumbers - ascending, 1-based
     * @param {Array<Object>} editorLineMap - from buildEditorLineMap()
     * @returns {Array<number>} Pixel top per line number, same order/length
     */
    measureEditorLineTops(lineNumbers, editorLineMap) {
        if (lineNumbers.length === 0) return [];

        const mirror = this.ensureMirror();
        this.syncMirrorStyle(mirror);

        const text = this.editor.value;
        mirror.textContent = '';

        let cursor = 0;
        const markers = [];
        for (const lineNumber of lineNumbers) {
            const startPos = editorLineMap[lineNumber - 1] ? editorLineMap[lineNumber - 1].startPos : cursor;
            if (startPos > cursor) {
                mirror.appendChild(document.createTextNode(text.slice(cursor, startPos)));
            }
            const marker = document.createElement('span');
            mirror.appendChild(marker);
            markers.push(marker);
            cursor = startPos;
        }
        mirror.appendChild(document.createTextNode(text.slice(cursor)));

        const paddingTop = parseFloat(getComputedStyle(mirror).paddingTop) || 0;
        return markers.map(marker => marker.offsetTop - paddingTop);
    }

    /**
     * Lazily create the hidden mirror <div> used by measureEditorLineTops().
     * @returns {HTMLElement}
     */
    ensureMirror() {
        if (this.mirror) return this.mirror;

        const mirror = document.createElement('div');
        mirror.setAttribute('aria-hidden', 'true');
        mirror.style.position = 'fixed';
        mirror.style.top = '0';
        mirror.style.left = '-99999px';
        mirror.style.visibility = 'hidden';
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.overflowWrap = 'break-word';
        mirror.style.boxSizing = 'content-box';

        document.body.appendChild(mirror);
        this.mirror = mirror;
        return mirror;
    }

    /**
     * Copy the textarea's font metrics, padding, and wrap width onto the
     * mirror so it wraps text at exactly the same points the textarea does.
     * @param {HTMLElement} mirror
     */
    syncMirrorStyle(mirror) {
        const cs = getComputedStyle(this.editor);
        const fontProps = [
            'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch',
            'lineHeight', 'letterSpacing', 'wordSpacing', 'tabSize', 'textIndent', 'textTransform'
        ];
        for (const prop of fontProps) {
            mirror.style[prop] = cs[prop];
        }

        mirror.style.paddingTop = cs.paddingTop;
        mirror.style.paddingBottom = cs.paddingBottom;
        mirror.style.paddingLeft = cs.paddingLeft;
        mirror.style.paddingRight = cs.paddingRight;

        const contentWidth = this.editor.clientWidth
            - parseFloat(cs.paddingLeft)
            - parseFloat(cs.paddingRight);
        mirror.style.width = Math.max(0, contentWidth) + 'px';
    }

    /**
     * Map an editor scrollTop to the proportionally-corresponding preview
     * scrollTop. See buildAnchors() for the interpolation this drives.
     * @param {number} editorScrollTop
     * @returns {number|null}
     */
    mapEditorToPreview(editorScrollTop) {
        return this.interpolate(editorScrollTop, 'editorTop', 'previewTop');
    }

    /**
     * Inverse of mapEditorToPreview.
     * @param {number} previewScrollTop
     * @returns {number|null}
     */
    mapPreviewToEditor(previewScrollTop) {
        return this.interpolate(previewScrollTop, 'previewTop', 'editorTop');
    }

    /**
     * Piecewise-linear interpolation over this.map.anchors: finds the pair
     * of anchors bracketing `value` (measured on `fromKey`) and returns the
     * proportionally-interpolated position on `toKey`.
     * @param {number} value
     * @param {'editorTop'|'previewTop'} fromKey
     * @param {'editorTop'|'previewTop'} toKey
     * @returns {number|null}
     */
    interpolate(value, fromKey, toKey) {
        const anchors = this.map && this.map.anchors;
        if (!anchors || anchors.length < 2) return null;

        let i = 0;
        while (i < anchors.length - 2 && anchors[i + 1][fromKey] <= value) {
            i++;
        }

        const a = anchors[i];
        const b = anchors[i + 1];
        const span = b[fromKey] - a[fromKey];
        const fraction = span > 0 ? (value - a[fromKey]) / span : 0;

        return a[toKey] + fraction * (b[toKey] - a[toKey]);
    }

    /**
     * Find preview element corresponding to editor line number
     * @param {number} lineNumber - Editor line number (1-based)
     * @returns {Object|null} Preview element info or null
     */
    findElementForLine(lineNumber) {
        if (!this.map || !this.map.preview) {
            console.warn('Content map not built');
            return null;
        }
        
        // Find element that contains this line
        const element = this.map.preview.find(item => 
            lineNumber >= item.startLine && lineNumber <= item.endLine
        );
        
        if (element) {
            return element;
        }
        
        // FALLBACK: No exact match - interpolate between nearest elements
        return this.interpolatePositionForLine(lineNumber);
    }
    
    /**
     * Interpolate preview position for unmapped line
     * @param {number} lineNumber - Editor line number (1-based)
     * @returns {Object|null} Interpolated position info or null
     */
    interpolatePositionForLine(lineNumber) {
        if (!this.map || !this.map.preview || this.map.preview.length === 0) {
            return null;
        }
        
        // Find the closest elements before and after this line
        let beforeElement = null;
        let afterElement = null;
        
        for (const item of this.map.preview) {
            if (item.endLine < lineNumber) {
                if (!beforeElement || item.endLine > beforeElement.endLine) {
                    beforeElement = item;
                }
            } else if (item.startLine > lineNumber) {
                if (!afterElement || item.startLine < afterElement.startLine) {
                    afterElement = item;
                }
            }
        }
        
        // If we have both, interpolate
        if (beforeElement && afterElement) {
            const lineRangeBetween = afterElement.startLine - beforeElement.endLine;
            const lineOffset = lineNumber - beforeElement.endLine;
            const ratio = lineOffset / lineRangeBetween;
            
            const startOffset = beforeElement.offsetTop + beforeElement.offsetHeight;
            const endOffset = afterElement.offsetTop;
            const interpolatedTop = startOffset + ((endOffset - startOffset) * ratio);
            
            return {
                element: beforeElement.element, // Use before element as reference
                startLine: lineNumber,
                endLine: lineNumber,
                offsetTop: interpolatedTop,
                offsetHeight: 0,
                tag: 'interpolated',
                lineRange: [beforeElement.endLine, afterElement.startLine]
            };
        }
        
        // Only have before element - extrapolate forward
        if (beforeElement) {
            const extrapolatedTop = beforeElement.offsetTop + beforeElement.offsetHeight + 
                                    ((lineNumber - beforeElement.endLine) * 20); // Assume ~20px per line
            
            return {
                element: beforeElement.element,
                startLine: lineNumber,
                endLine: lineNumber,
                offsetTop: extrapolatedTop,
                offsetHeight: 0,
                tag: 'extrapolated',
                lineRange: [beforeElement.endLine, lineNumber]
            };
        }
        
        // Only have after element - extrapolate backward
        if (afterElement) {
            const extrapolatedTop = Math.max(0, afterElement.offsetTop - 
                                            ((afterElement.startLine - lineNumber) * 20));
            
            return {
                element: afterElement.element,
                startLine: lineNumber,
                endLine: lineNumber,
                offsetTop: extrapolatedTop,
                offsetHeight: 0,
                tag: 'extrapolated',
                lineRange: [lineNumber, afterElement.startLine]
            };
        }
        
        // No elements at all - return first or last element
        if (this.map.preview.length > 0) {
            return this.map.preview[0];
        }
        
        return null;
    }

    /**
     * Find preview element at specific scroll position
     * @param {number} scrollTop - Preview scroll position
     * @returns {Object|null} Preview element info or null
     */
    findElementAtScrollPosition(scrollTop) {
        if (!this.map || !this.map.preview) {
            return null;
        }
        
        // Find element whose area contains the scroll position
        const element = this.map.preview.find(item => {
            const elementTop = item.offsetTop;
            const elementBottom = elementTop + item.offsetHeight;
            return scrollTop >= elementTop && scrollTop < elementBottom;
        });
        
        return element || null;
    }

    /**
     * Get editor line number from character position
     * @param {number} charPos - Character position in editor
     * @returns {number} Line number (1-based)
     */
    getLineNumberFromCharPosition(charPos) {
        if (!this.map || !this.map.editor) {
            return 1;
        }
        
        const line = this.map.editor.find(item => 
            charPos >= item.startPos && charPos <= item.endPos
        );
        
        return line ? line.lineNumber : 1;
    }

    /**
     * Get character position for line number
     * @param {number} lineNumber - Line number (1-based)
     * @returns {number} Character position
     */
    getCharPositionForLine(lineNumber) {
        if (!this.map || !this.map.editor) {
            return 0;
        }
        
        const line = this.map.editor.find(item => item.lineNumber === lineNumber);
        return line ? line.startPos : 0;
    }

    /**
     * Check if content map needs rebuilding
     * @returns {boolean} True if map should be rebuilt
     */
    needsRebuild() {
        if (!this.map) return true;
        
        // Check if editor line count changed
        const currentLines = this.editor.value.split('\n').length;
        if (currentLines !== this.map.totalLines) {
            return true;
        }
        
        // Check if preview elements changed
        const currentElements = this.getContentRoots()
            .reduce((count, root) => count + root.querySelectorAll('[data-line-start]').length, 0);
        if (currentElements !== this.map.preview.length) {
            return true;
        }
        
        return false;
    }

    /**
     * Get mapping statistics for debugging
     * @returns {Object} Mapping statistics
     */
    getStats() {
        if (!this.map) {
            return { mapped: false };
        }
        
        return {
            mapped: true,
            totalLines: this.map.totalLines,
            totalElements: this.map.preview.length,
            totalAnchors: this.map.anchors.length,
            buildTime: this.lastBuildTime,
            coverage: (this.map.preview.length / this.map.totalLines * 100).toFixed(1) + '%'
        };
    }

    /**
     * Clear the content map
     */
    clear() {
        this.map = null;
        this.lastBuildTime = 0;
    }
}
