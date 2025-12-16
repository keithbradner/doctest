// HTML to BBCode conversion tests
// Run with: node tests/htmlToBBCode.test.js

const { JSDOM } = require('jsdom');

// Set up DOM globals for the converter
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;

// Import the converter (we'll inline it since it's ES module)
function htmlToBBCode(html) {
  if (!html) return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const hasLinks = doc.querySelectorAll('a[href]').length > 0;
  const hasBold = doc.querySelectorAll('b, strong').length > 0;
  const hasItalic = doc.querySelectorAll('i, em').length > 0;
  const hasUnderline = doc.querySelectorAll('u').length > 0;
  const hasLists = doc.querySelectorAll('ul, ol').length > 0;

  if (!hasLinks && !hasBold && !hasItalic && !hasUnderline && !hasLists) {
    return null;
  }

  const isWrapperElement = (node, tagNames) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const tagName = node.tagName.toLowerCase();
    if (!tagNames.includes(tagName)) return false;
    const siblings = Array.from(node.parentNode.childNodes).filter(n =>
      n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent.trim())
    );
    return siblings.length === 1;
  };

  const convertNode = (node, isTopLevel = false) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      let childContent = Array.from(node.childNodes).map(n => convertNode(n, false)).join('');

      if (tagName === 'a' && node.href) {
        const href = node.getAttribute('href');
        if (childContent.trim() === href) {
          return `[url]${href}[/url]`;
        }
        return `[url=${href}]${childContent}[/url]`;
      }

      if (tagName === 'b' || tagName === 'strong') {
        if (isTopLevel && isWrapperElement(node, ['b', 'strong'])) {
          return childContent;
        }
        return `[b]${childContent}[/b]`;
      }

      if (tagName === 'i' || tagName === 'em') {
        if (isTopLevel && isWrapperElement(node, ['i', 'em'])) {
          return childContent;
        }
        return `[i]${childContent}[/i]`;
      }

      if (tagName === 'u') {
        if (isTopLevel && isWrapperElement(node, ['u'])) {
          return childContent;
        }
        return `[u]${childContent}[/u]`;
      }

      if (tagName === 'ul') {
        const items = Array.from(node.querySelectorAll(':scope > li'))
          .map(li => `[*]${convertNode(li, false).trim()}`)
          .join('\n');
        return `[list]\n${items}\n[/list]`;
      }
      if (tagName === 'ol') {
        const items = Array.from(node.querySelectorAll(':scope > li'))
          .map(li => `[*]${convertNode(li, false).trim()}`)
          .join('\n');
        return `[olist]\n${items}\n[/olist]`;
      }
      if (tagName === 'li') {
        return childContent;
      }

      if (tagName === 'br') {
        return '\n';
      }
      if (tagName === 'p' || tagName === 'div') {
        return childContent + '\n';
      }

      return childContent;
    }

    return '';
  };

  const convertedText = Array.from(doc.body.childNodes)
    .map(n => convertNode(n, true))
    .join('')
    .trim();

  if (convertedText.includes('[url') || convertedText.includes('[b]') ||
      convertedText.includes('[i]') || convertedText.includes('[u]') ||
      convertedText.includes('[list]') || convertedText.includes('[olist]')) {
    return convertedText;
  }

  return null;
}

// Test runner
const tests = [
  // Links
  {
    name: 'Link - basic with different text',
    input: '<a href="https://example.com">Click here</a>',
    expected: '[url=https://example.com]Click here[/url]'
  },
  {
    name: 'Link - URL as text uses simple format',
    input: '<a href="https://example.com">https://example.com</a>',
    expected: '[url]https://example.com[/url]'
  },
  {
    name: 'Link - multiple links',
    input: '<a href="https://a.com">A</a> and <a href="https://b.com">B</a>',
    expected: '[url=https://a.com]A[/url] and [url=https://b.com]B[/url]'
  },

  // Bold
  {
    name: 'Bold - using b tag',
    input: 'Some <b>bold</b> text',
    expected: 'Some [b]bold[/b] text'
  },
  {
    name: 'Bold - using strong tag',
    input: 'Some <strong>bold</strong> text',
    expected: 'Some [b]bold[/b] text'
  },
  {
    name: 'Bold - wrapper should be ignored',
    input: '<b>This entire text is wrapped</b>',
    expected: null
  },
  {
    name: 'Bold - wrapper with link inside should still convert link',
    input: '<b>Check <a href="https://example.com">this</a> out</b>',
    expected: 'Check [url=https://example.com]this[/url] out'
  },

  // Italic
  {
    name: 'Italic - using i tag',
    input: 'Some <i>italic</i> text',
    expected: 'Some [i]italic[/i] text'
  },
  {
    name: 'Italic - using em tag',
    input: 'Some <em>italic</em> text',
    expected: 'Some [i]italic[/i] text'
  },
  {
    name: 'Italic - wrapper should be ignored',
    input: '<i>This entire text is wrapped</i>',
    expected: null
  },

  // Underline
  {
    name: 'Underline - basic',
    input: 'Some <u>underlined</u> text',
    expected: 'Some [u]underlined[/u] text'
  },
  {
    name: 'Underline - wrapper should be ignored',
    input: '<u>This entire text is wrapped</u>',
    expected: null
  },

  // Mixed formatting
  {
    name: 'Mixed - bold and italic',
    input: 'This is <b>bold</b> and <i>italic</i> text',
    expected: 'This is [b]bold[/b] and [i]italic[/i] text'
  },
  {
    name: 'Mixed - nested formatting',
    input: 'This is <b><i>bold italic</i></b> text',
    expected: 'This is [b][i]bold italic[/i][/b] text'
  },
  {
    name: 'Mixed - link with bold text',
    input: '<a href="https://example.com"><b>Bold Link</b></a>',
    expected: '[url=https://example.com][b]Bold Link[/b][/url]'
  },

  // Lists
  {
    name: 'List - unordered',
    input: '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>',
    expected: '[list]\n[*]Item 1\n[*]Item 2\n[*]Item 3\n[/list]'
  },
  {
    name: 'List - ordered',
    input: '<ol><li>First</li><li>Second</li><li>Third</li></ol>',
    expected: '[olist]\n[*]First\n[*]Second\n[*]Third\n[/olist]'
  },
  {
    name: 'List - with formatting in items',
    input: '<ul><li><b>Bold</b> item</li><li>Normal item</li></ul>',
    expected: '[list]\n[*][b]Bold[/b] item\n[*]Normal item\n[/list]'
  },
  {
    name: 'List - with link in item',
    input: '<ul><li>Check <a href="https://example.com">this</a></li></ul>',
    expected: '[list]\n[*]Check [url=https://example.com]this[/url]\n[/list]'
  },

  // Plain text
  {
    name: 'Plain text - no formatting',
    input: 'Just plain text',
    expected: null
  },
  {
    name: 'Plain text - only paragraphs',
    input: '<p>Paragraph 1</p><p>Paragraph 2</p>',
    expected: null
  },

  // Real-world scenarios
  {
    name: 'Google Docs style - span wrapper with link',
    input: '<span>Check out <a href="https://docs.google.com">Google Docs</a> for more</span>',
    expected: 'Check out [url=https://docs.google.com]Google Docs[/url] for more'
  },
  {
    name: 'Multiple paragraphs with formatting',
    input: '<p>First <b>bold</b> para</p><p>Second <i>italic</i> para</p>',
    expected: 'First [b]bold[/b] para\nSecond [i]italic[/i] para'
  },
  {
    name: 'Complex - mixed content',
    input: '<p>Hello <b>world</b>! Visit <a href="https://example.com">our site</a>.</p><ul><li>Item 1</li><li>Item 2</li></ul>',
    expected: 'Hello [b]world[/b]! Visit [url=https://example.com]our site[/url].\n[list]\n[*]Item 1\n[*]Item 2\n[/list]'
  }
];

// Run tests
console.log('\n🧪 HTML to BBCode Conversion Tests');
console.log('==================================================\n');

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  const result = htmlToBBCode(test.input);
  const success = result === test.expected;

  if (success) {
    console.log(`✅ Test ${index + 1}: ${test.name}`);
    passed++;
  } else {
    console.log(`❌ Test ${index + 1}: ${test.name}`);
    console.log(`   Input:    ${test.input}`);
    console.log(`   Expected: ${test.expected}`);
    console.log(`   Got:      ${result}`);
    failed++;
  }
});

console.log('\n==================================================');
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${tests.length} tests`);

if (failed === 0) {
  console.log('✅ All tests passed!\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed!\n');
  process.exit(1);
}
