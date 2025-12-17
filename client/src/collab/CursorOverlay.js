import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * CursorOverlay renders colored cursor indicators for remote users
 * over a textarea element.
 *
 * Technique:
 * 1. Create a hidden "mirror" div with same font/size as textarea
 * 2. Copy textarea content up to cursor position into mirror
 * 3. Use mirror dimensions to calculate cursor X/Y position
 * 4. Render absolutely positioned cursor elements
 */
function CursorOverlay({ textareaRef, cursors, content, currentUserId }) {
  const mirrorRef = useRef(null);
  const [cursorPositions, setCursorPositions] = useState({});

  const calculatePositions = useCallback(() => {
    if (!textareaRef?.current || !mirrorRef.current) return;

    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    const positions = {};

    // Get computed styles from textarea
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

    // Get textarea scroll position
    const scrollTop = textarea.scrollTop;
    const scrollLeft = textarea.scrollLeft;

    Object.entries(cursors).forEach(([userId, cursorData]) => {
      // Skip current user's cursor
      if (parseInt(userId) === currentUserId) return;

      const position = cursorData.position || 0;
      const textBefore = content.substring(0, position);

      // Set mirror content and add a marker span
      mirror.innerHTML = '';
      const textNode = document.createTextNode(textBefore);
      mirror.appendChild(textNode);

      // Add a zero-width marker at cursor position
      const marker = document.createElement('span');
      marker.innerHTML = '|';
      marker.style.position = 'relative';
      mirror.appendChild(marker);

      // Calculate position relative to textarea
      const markerRect = marker.getBoundingClientRect();
      const mirrorRect = mirror.getBoundingClientRect();

      // Position relative to mirror (which already has matching padding)
      let x = markerRect.left - mirrorRect.left - scrollLeft;
      let y = markerRect.top - mirrorRect.top - scrollTop;

      // Get line height for cursor height
      const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.2;

      // The mirror already has padding applied, so no need to add it again
      // Just use x and y directly
      positions[userId] = {
        x: x,
        y: y,
        height: lineHeight,
        color: cursorData.color,
        username: cursorData.username,
        visible: y >= -lineHeight && y < textarea.clientHeight // Hide if scrolled out of view
      };
    });

    setCursorPositions(positions);
  }, [cursors, content, currentUserId, textareaRef]);

  useEffect(() => {
    calculatePositions();

    // Recalculate on scroll
    const textarea = textareaRef?.current;
    if (textarea) {
      textarea.addEventListener('scroll', calculatePositions);
      window.addEventListener('resize', calculatePositions);

      return () => {
        textarea.removeEventListener('scroll', calculatePositions);
        window.removeEventListener('resize', calculatePositions);
      };
    }
  }, [calculatePositions, textareaRef]);

  // Recalculate when content or cursors change
  useEffect(() => {
    calculatePositions();
  }, [content, cursors, calculatePositions]);

  return (
    <>
      {/* Hidden mirror for position calculation */}
      <div
        ref={mirrorRef}
        className="cursor-mirror"
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

      {/* Render cursor indicators */}
      {Object.entries(cursorPositions).map(([userId, pos]) => {
        if (!pos.visible) return null;

        return (
          <div
            key={userId}
            className="remote-cursor"
            style={{
              position: 'absolute',
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              height: `${pos.height}px`,
              borderLeft: `2px solid ${pos.color}`,
              zIndex: 10,
              transition: 'left 0.1s ease-out, top 0.1s ease-out'
            }}
          >
            <span
              className="cursor-label"
              style={{
                backgroundColor: pos.color,
                color: 'white',
                position: 'absolute',
                top: '-16px',
                left: '-1px',
                fontFamily: 'sans-serif',
                fontWeight: '500',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }}
            >
              {pos.username}
            </span>
          </div>
        );
      })}
    </>
  );
}

export default CursorOverlay;
