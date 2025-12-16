import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * EditHighlight renders fading background highlights for recently edited text.
 * Uses a mirror div technique to position highlights over textarea content.
 */
function EditHighlight({ textareaRef, editRanges, content }) {
  const mirrorRef = useRef(null);
  const [highlightElements, setHighlightElements] = useState([]);

  const calculateHighlights = useCallback(() => {
    if (!textareaRef?.current || !mirrorRef.current || editRanges.length === 0) {
      setHighlightElements([]);
      return;
    }

    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    const computedStyle = window.getComputedStyle(textarea);

    // Apply same styles to mirror
    mirror.style.fontFamily = computedStyle.fontFamily;
    mirror.style.fontSize = computedStyle.fontSize;
    mirror.style.fontWeight = computedStyle.fontWeight;
    mirror.style.lineHeight = computedStyle.lineHeight;
    mirror.style.letterSpacing = computedStyle.letterSpacing;
    mirror.style.padding = computedStyle.padding;
    mirror.style.border = computedStyle.border;
    mirror.style.boxSizing = computedStyle.boxSizing;
    mirror.style.width = `${textarea.clientWidth}px`;
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.overflowWrap = 'break-word';

    const scrollTop = textarea.scrollTop;
    const scrollLeft = textarea.scrollLeft;
    const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.2;

    const highlights = [];

    editRanges.forEach((range, rangeIndex) => {
      const { start, end, timestamp, color, userId } = range;
      const age = Date.now() - timestamp;

      // Skip if highlight has fully faded (older than 1.5 seconds)
      if (age > 1500) return;

      // Calculate opacity based on age (fade from 1 to 0 over 1.5 seconds)
      const opacity = Math.max(0, 1 - (age / 1500));

      // Get the text for this range
      const highlightText = content.substring(start, end);
      if (!highlightText) return;

      // For each character in the range, calculate its position
      // Group consecutive characters on the same line for efficiency
      let currentLineStart = start;

      for (let i = start; i <= end; i++) {
        const char = content[i];
        const isNewline = char === '\n' || i === end;

        if (isNewline || i === end) {
          // Calculate rectangle for this line segment
          if (i > currentLineStart) {
            const textBefore = content.substring(0, currentLineStart);
            const segmentText = content.substring(currentLineStart, i);

            // Set mirror content to calculate start position
            mirror.innerHTML = '';
            const beforeNode = document.createTextNode(textBefore);
            mirror.appendChild(beforeNode);
            const startMarker = document.createElement('span');
            startMarker.textContent = '|';
            mirror.appendChild(startMarker);

            const startRect = startMarker.getBoundingClientRect();
            const mirrorRect = mirror.getBoundingClientRect();

            // Calculate end position
            mirror.innerHTML = '';
            const beforeEndNode = document.createTextNode(textBefore + segmentText);
            mirror.appendChild(beforeEndNode);
            const endMarker = document.createElement('span');
            endMarker.textContent = '|';
            mirror.appendChild(endMarker);

            const endRect = endMarker.getBoundingClientRect();

            const x1 = startRect.left - mirrorRect.left - scrollLeft;
            const x2 = endRect.left - mirrorRect.left - scrollLeft;
            const y = startRect.top - mirrorRect.top - scrollTop;

            // Only show if visible
            if (y >= -lineHeight && y < textarea.clientHeight + lineHeight) {
              highlights.push({
                id: `${rangeIndex}-${currentLineStart}`,
                x: x1,
                y: y,
                width: Math.max(4, x2 - x1),
                height: lineHeight,
                opacity,
                color: color || 'rgba(255, 230, 0, 0.5)',
                userId
              });
            }
          }
          currentLineStart = i + 1;
        }
      }
    });

    setHighlightElements(highlights);
  }, [editRanges, content, textareaRef]);

  useEffect(() => {
    calculateHighlights();

    const textarea = textareaRef?.current;
    if (textarea) {
      textarea.addEventListener('scroll', calculateHighlights);
      window.addEventListener('resize', calculateHighlights);

      return () => {
        textarea.removeEventListener('scroll', calculateHighlights);
        window.removeEventListener('resize', calculateHighlights);
      };
    }
  }, [calculateHighlights, textareaRef]);

  // Recalculate periodically during fade
  useEffect(() => {
    if (editRanges.length === 0) return;

    const interval = setInterval(() => {
      calculateHighlights();
    }, 50); // Update every 50ms for smooth fade

    return () => clearInterval(interval);
  }, [editRanges, calculateHighlights]);

  return (
    <>
      {/* Hidden mirror for position calculation */}
      <div
        ref={mirrorRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          top: 0,
          left: 0,
          zIndex: -1
        }}
      />

      {/* Render highlight rectangles */}
      {highlightElements.map((highlight) => (
        <div
          key={highlight.id}
          className="edit-highlight"
          style={{
            position: 'absolute',
            left: `${highlight.x}px`,
            top: `${highlight.y}px`,
            width: `${highlight.width}px`,
            height: `${highlight.height}px`,
            backgroundColor: highlight.color,
            opacity: highlight.opacity,
            pointerEvents: 'none',
            zIndex: 1,
            borderRadius: '2px',
            transition: 'opacity 0.1s ease-out'
          }}
        />
      ))}
    </>
  );
}

export default EditHighlight;
