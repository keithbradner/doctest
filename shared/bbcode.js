// BBCode parser - Shared between server and client
//
// IMPORTANT: This file is copied to client/src/utils/bbcode.js for React builds
// If you modify this file, run: cp shared/bbcode.js client/src/utils/bbcode.js
// (Create React App doesn't allow imports from outside src/)
//
// BBCode parser
const parseBBCode = (text) => {
  if (!text) return '';

  let html = text;

  // Escape HTML helper function
  const escapeHtml = (str) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, (m) => map[m]);
  };

  // Process [noparse] blocks FIRST - extract and escape their content
  const noparseBlocks = [];
  html = html.replace(/\[noparse\](.*?)\[\/noparse\]/gs, (match, content) => {
    const index = noparseBlocks.length;
    noparseBlocks.push(escapeHtml(content));
    return `___NOPARSE_${index}___`;
  });

  // Process [code] blocks SECOND - extract and escape their content
  const codeBlocks = [];
  html = html.replace(/\[code\](.*?)\[\/code\]/gs, (match, content) => {
    const index = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(content)}</code></pre>`);
    return `___CODE_${index}___`;
  });

  // CRITICAL: Now escape ALL remaining HTML before processing other BBCode
  // This prevents users from injecting raw HTML/scripts outside of code/noparse blocks
  // BBCode brackets [ and ] are not affected by HTML escaping, only < > & " ' are escaped
  html = escapeHtml(html);

  // Headers
  html = html.replace(/\[h1\](.*?)\[\/h1\]/gi, '<h1>$1</h1>');
  html = html.replace(/\[h2\](.*?)\[\/h2\]/gi, '<h2>$1</h2>');
  html = html.replace(/\[h3\](.*?)\[\/h3\]/gi, '<h3>$1</h3>');

  // Text formatting
  html = html.replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>');
  html = html.replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>');
  html = html.replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>');
  html = html.replace(/\[strike\](.*?)\[\/strike\]/gi, '<del>$1</del>');

  // Spoiler
  html = html.replace(/\[spoiler\](.*?)\[\/spoiler\]/gi, '<span class="spoiler">$1</span>');

  // TODO - Highlighted text with tooltip note
  html = html.replace(/\[todo=(.*?)\](.*?)\[\/todo\]/gi, '<span class="todo-highlight" data-todo="$1">$2</span>');

  // Horizontal rule
  html = html.replace(/\[hr\]/gi, '<hr />');

  // Links
  html = html.replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');
  html = html.replace(/\[url\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

  // Images
  html = html.replace(/\[img\](.*?)\[\/img\]/gi, '<img src="$1" alt="Image" />');

  // Quote
  html = html.replace(/\[quote=(.*?)\](.*?)\[\/quote\]/gs, '<blockquote class="quote"><div class="quote-author">Originally posted by $1:</div>$2</blockquote>');
  html = html.replace(/\[quote\](.*?)\[\/quote\]/gs, '<blockquote class="quote">$1</blockquote>');

  // Callout (info banner) - supports color variants: [callout=green], [callout=red], etc.
  html = html.replace(/\[callout=(lightblue|green|red|yellow|gray|grey)\](.*?)\[\/callout\]/gs, '<div class="callout $1"><div>$2</div></div>');
  html = html.replace(/\[callout\](.*?)\[\/callout\]/gs, '<div class="callout"><div>$1</div></div>');

  // Lists - unordered
  html = html.replace(/\[list\](.*?)\[\/list\]/gs, (match, content) => {
    const items = content.replace(/\[\*\]/g, '<li>').replace(/<li>\s*/g, '<li>');
    return `<ul>${items}</ul>`;
  });

  // Lists - ordered
  html = html.replace(/\[olist\](.*?)\[\/olist\]/gs, (match, content) => {
    const items = content.replace(/\[\*\]/g, '<li>').replace(/<li>\s*/g, '<li>');
    return `<ol>${items}</ol>`;
  });

  // YouTube video embed - [previewyoutube]VIDEO_ID[/previewyoutube]
  html = html.replace(/\[previewyoutube\](.*?)\[\/previewyoutube\]/gi, (match, videoId) => {
    const cleanId = videoId.trim();
    return `<div class="youtube-embed"><iframe src="https://www.youtube.com/embed/${cleanId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
  });

  // Restore code blocks
  codeBlocks.forEach((code, index) => {
    html = html.replace(`___CODE_${index}___`, code);
  });

  // Restore noparse blocks
  noparseBlocks.forEach((content, index) => {
    html = html.replace(`___NOPARSE_${index}___`, content);
  });

  // Convert newlines to <br>, but intelligently:
  // - Remove newlines immediately after opening or before closing block tags
  // - Convert double newlines to paragraph breaks
  // - Convert single newlines to <br> only within inline content
  html = html.replace(/(<\/(h[123]|ul|ol|blockquote|pre|hr|div)>)\n+/g, '$1');
  html = html.replace(/\n+(<(h[123]|ul|ol|blockquote|pre|hr|li|div)>)/g, '$1');
  html = html.replace(/(<hr \/>)\n+/g, '$1');

  // Convert remaining double newlines to paragraph breaks
  html = html.replace(/\n\n+/g, '</p><p>');

  // Convert single newlines to <br>
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraphs if not already in block elements
  if (!html.match(/^<(h[123]|ul|ol|blockquote|pre|p)/)) {
    html = '<p>' + html + '</p>';
  }

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
};

// Export for both Node.js (CommonJS) and ES6 modules (React)
if (typeof module !== 'undefined' && module.exports) {
  // Node.js
  module.exports = { parseBBCode };
} else if (typeof window !== 'undefined') {
  // Browser (fallback)
  window.parseBBCode = parseBBCode;
}
