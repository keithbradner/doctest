const { parseBBCode } = require('../server/bbcode');

// Test suite for BBCode parser
const tests = [
  {
    name: 'Basic text formatting',
    input: '[b]Bold[/b] [i]Italic[/i] [u]Underline[/u] [strike]Strike[/strike]',
    expected: /<strong>Bold<\/strong>.*<em>Italic<\/em>.*<u>Underline<\/u>.*<del>Strike<\/del>/
  },
  {
    name: 'Headers',
    input: '[h1]Header 1[/h1]\n[h2]Header 2[/h2]\n[h3]Header 3[/h3]',
    expected: /<h1>Header 1<\/h1>.*<h2>Header 2<\/h2>.*<h3>Header 3<\/h3>/
  },
  {
    name: 'Links',
    input: '[url=https://example.com]Example[/url] [url]https://test.com[/url]',
    expected: /<a href="https:\/\/example\.com".*>Example<\/a>.*<a href="https:\/\/test\.com".*>https:\/\/test\.com<\/a>/
  },
  {
    name: 'Images',
    input: '[img]https://example.com/image.png[/img]',
    expected: /<img src="https:\/\/example\.com\/image\.png"/
  },
  {
    name: 'Lists - unordered',
    input: '[list][*]Item 1[*]Item 2[*]Item 3[/list]',
    expected: /<ul>.*<li>Item 1<li>Item 2<li>Item 3.*<\/ul>/
  },
  {
    name: 'Lists - ordered',
    input: '[olist][*]First[*]Second[*]Third[/olist]',
    expected: /<ol>.*<li>First<li>Second<li>Third.*<\/ol>/
  },
  {
    name: 'Quote blocks',
    input: '[quote]This is a quote[/quote]',
    expected: /<blockquote class="quote">This is a quote<\/blockquote>/
  },
  {
    name: 'Quote with author',
    input: '[quote=John]Hello world[/quote]',
    expected: /<blockquote class="quote">.*Originally posted by John:.*Hello world<\/blockquote>/
  },
  {
    name: 'Horizontal rule',
    input: 'Text before[hr]Text after',
    expected: /Text before<hr \/>Text after/
  },
  {
    name: 'Spoiler tag',
    input: '[spoiler]Secret text[/spoiler]',
    expected: /<span class="spoiler">Secret text<\/span>/
  },
  {
    name: 'Code block - BBCode inside should NOT be processed',
    input: '[code][b]This should not be bold[/b][/code]',
    expected: /<pre><code>\[b\]This should not be bold\[\/b\]<\/code><\/pre>/
  },
  {
    name: 'Code block - HTML should be escaped',
    input: '[code]<script>alert("XSS")</script>[/code]',
    expected: /<pre><code>&lt;script&gt;alert\(&quot;XSS&quot;\)&lt;\/script&gt;<\/code><\/pre>/
  },
  {
    name: 'Code block - Image tag should NOT render',
    input: '[code][img]https://evil.com/image.png[/img][/code]',
    expected: /<pre><code>\[img\]https:\/\/evil\.com\/image\.png\[\/img\]<\/code><\/pre>/
  },
  {
    name: 'Code block - URL tag should NOT render',
    input: '[code][url=https://evil.com]Click me[/url][/code]',
    expected: /<pre><code>\[url=https:\/\/evil\.com\]Click me\[\/url\]<\/code><\/pre>/
  },
  {
    name: 'Noparse - BBCode inside should NOT be processed',
    input: '[noparse][b]Not bold[/b] [i]Not italic[/i][/noparse]',
    expected: /\[b\]Not bold\[\/b\] \[i\]Not italic\[\/i\]/
  },
  {
    name: 'Noparse - HTML should be escaped',
    input: '[noparse]<div>HTML</div>[/noparse]',
    expected: /&lt;div&gt;HTML&lt;\/div&gt;/
  },
  {
    name: 'Noparse - Image tag should NOT render',
    input: '[noparse][img]https://example.com/test.jpg[/img][/noparse]',
    expected: /\[img\]https:\/\/example\.com\/test\.jpg\[\/img\]/
  },
  {
    name: 'Noparse - Complex BBCode should NOT be processed',
    input: '[noparse][h1]Title[/h1] [url=test]Link[/url] [list][*]Item[/list][/noparse]',
    expected: /\[h1\]Title\[\/h1\].*\[url=test\]Link\[\/url\].*\[list\]\[\*\]Item\[\/list\]/
  },
  {
    name: 'Mixed content - code inside regular text',
    input: 'Regular text [b]bold[/b] then [code][b]code[/b][/code] more text',
    expected: /Regular text <strong>bold<\/strong> then <pre><code>\[b\]code\[\/b\]<\/code><\/pre> more text/
  },
  {
    name: 'Nested formatting allowed',
    input: '[b]Bold and [i]italic[/i] together[/b]',
    expected: /<strong>Bold and <em>italic<\/em> together<\/strong>/
  },
  {
    name: 'Line spacing - no extra breaks after headers',
    input: '[h1]Title[/h1]\nContent here',
    expected: /<h1>Title<\/h1>(?!<br>).*Content here/
  },
  {
    name: 'Line spacing - paragraphs from double newlines',
    input: 'Paragraph 1\n\nParagraph 2',
    expected: /<p>Paragraph 1<\/p><p>Paragraph 2<\/p>/
  },
  {
    name: 'Line spacing - single newline becomes <br>',
    input: 'Line 1\nLine 2',
    expected: /<p>Line 1<br>Line 2<\/p>/
  },
  {
    name: 'XSS prevention in code blocks',
    input: '[code]<img src=x onerror=alert(1)>[/code]',
    expected: /&lt;img src=x onerror=alert\(1\)&gt;/
  },
  {
    name: 'XSS prevention in noparse',
    input: '[noparse]<script>document.cookie</script>[/noparse]',
    expected: /&lt;script&gt;document\.cookie&lt;\/script&gt;/
  }
];

// Run tests
let passed = 0;
let failed = 0;

console.log('\n🧪 BBCode Parser Tests\n' + '='.repeat(50) + '\n');

tests.forEach((test, index) => {
  try {
    const result = parseBBCode(test.input);
    const matches = test.expected.test(result);

    if (matches) {
      console.log(`✅ Test ${index + 1}: ${test.name}`);
      passed++;
    } else {
      console.log(`❌ Test ${index + 1}: ${test.name}`);
      console.log(`   Input:    ${test.input}`);
      console.log(`   Expected: ${test.expected}`);
      console.log(`   Got:      ${result}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ Test ${index + 1}: ${test.name} (Error)`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
});

console.log('\n' + '='.repeat(50));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${tests.length} tests`);

if (failed === 0) {
  console.log('✅ All tests passed!\n');
  process.exit(0);
} else {
  console.log(`❌ ${failed} test(s) failed\n`);
  process.exit(1);
}
