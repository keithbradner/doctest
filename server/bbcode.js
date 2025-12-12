// BBCode parser
const parseBBCode = (text) => {
  if (!text) return '';

  let html = text;

  // Escape HTML first (but we'll need to unescape for our own tags later)
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

  // Process [noparse] blocks first - preserve them
  const noparseBlocks = [];
  html = html.replace(/\[noparse\](.*?)\[\/noparse\]/gs, (match, content) => {
    const index = noparseBlocks.length;
    noparseBlocks.push(escapeHtml(content));
    return `___NOPARSE_${index}___`;
  });

  // Process [code] blocks - preserve formatting and escape HTML
  const codeBlocks = [];
  html = html.replace(/\[code\](.*?)\[\/code\]/gs, (match, content) => {
    const index = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(content)}</code></pre>`);
    return `___CODE_${index}___`;
  });

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

  // Restore code blocks
  codeBlocks.forEach((code, index) => {
    html = html.replace(`___CODE_${index}___`, code);
  });

  // Restore noparse blocks
  noparseBlocks.forEach((content, index) => {
    html = html.replace(`___NOPARSE_${index}___`, content);
  });

  // Convert newlines to <br> (but not inside block elements)
  html = html.replace(/\n/g, '<br>');

  return html;
};

module.exports = { parseBBCode };
