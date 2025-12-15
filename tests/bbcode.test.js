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
  },
  {
    name: 'Raw HTML should be escaped - script tag',
    input: 'Normal text <script>alert("XSS")</script> more text',
    expected: /&lt;script&gt;alert\(&quot;XSS&quot;\)&lt;\/script&gt;/
  },
  {
    name: 'Raw HTML should be escaped - img tag with onerror',
    input: '<img src=x onerror=alert(1)>',
    expected: /&lt;img src=x onerror=alert\(1\)&gt;/
  },
  {
    name: 'Raw HTML should be escaped - mixed with BBCode',
    input: '[b]Bold</b> <script>alert(1)</script> [i]Italic</i>',
    expected: /&lt;script&gt;.*&lt;\/script&gt;/
  },
  {
    name: 'Raw HTML should be escaped - iframe injection',
    input: '<iframe src="javascript:alert(1)"></iframe>',
    expected: /&lt;iframe.*&lt;\/iframe&gt;/
  },
  {
    name: 'Raw HTML entities should remain escaped',
    input: 'Price: &lt;$50 &amp; &gt;$20',
    expected: /&amp;lt;\$50 &amp;amp; &amp;gt;\$20/
  },
  {
    name: 'HTML in BBCode should be escaped',
    input: '[url=javascript:alert(1)]Click me[/url]',
    expected: /<a href="javascript:alert\(1\)"/
  },
  {
    name: 'Only BBCode processed, not HTML tags',
    input: '[b]BBCode bold[/b] <b>HTML bold should not work</b>',
    expected: /<strong>BBCode bold<\/strong>.*&lt;b&gt;HTML bold should not work&lt;\/b&gt;/
  },
  {
    name: 'TODO highlight - basic usage',
    input: '[todo=need to confirm with bob]pricing details[/todo]',
    expected: /<span class="todo-highlight" data-todo="need to confirm with bob">pricing details<\/span>/
  },
  {
    name: 'TODO highlight - with special characters in note',
    input: '[todo=verify this (urgent!)]commission rate[/todo]',
    expected: /<span class="todo-highlight" data-todo="verify this \(urgent!\)">commission rate<\/span>/
  },
  {
    name: 'TODO highlight - HTML in note should be escaped',
    input: '[todo=<script>alert(1)</script>]text[/todo]',
    expected: /<span class="todo-highlight" data-todo="&lt;script&gt;alert\(1\)&lt;\/script&gt;">text<\/span>/
  },
  {
    name: 'TODO highlight - empty note',
    input: '[todo=]highlighted text[/todo]',
    expected: /<span class="todo-highlight" data-todo="">highlighted text<\/span>/
  },
  {
    name: 'TODO highlight - multiple TODOs in one line',
    input: '[todo=check A]first[/todo] and [todo=check B]second[/todo]',
    expected: /<span class="todo-highlight" data-todo="check A">first<\/span>.*<span class="todo-highlight" data-todo="check B">second<\/span>/
  },
  {
    name: 'TODO highlight - with bold formatting inside',
    input: '[todo=review this][b]important text[/b][/todo]',
    expected: /<span class="todo-highlight" data-todo="review this"><strong>important text<\/strong><\/span>/
  },
  {
    name: 'TODO highlight - quotes in note should be escaped',
    input: '[todo=Bob said "check this"]content[/todo]',
    expected: /<span class="todo-highlight" data-todo="Bob said &quot;check this&quot;">content<\/span>/
  },
  {
    name: 'TODO highlight - mixed with other formatting',
    input: 'Regular text [todo=verify]this part[/todo] and [b]bold text[/b]',
    expected: /Regular text <span class="todo-highlight" data-todo="verify">this part<\/span>.*<strong>bold text<\/strong>/
  },
  {
    name: 'TODO highlight - long note text',
    input: '[todo=need to update this after the Q4 meeting with stakeholders]quarterly targets[/todo]',
    expected: /<span class="todo-highlight" data-todo="need to update this after the Q4 meeting with stakeholders">quarterly targets<\/span>/
  },
  {
    name: 'TODO highlight - inside code block should NOT be processed',
    input: '[code][todo=note]text[/todo][/code]',
    expected: /<pre><code>\[todo=note\]text\[\/todo\]<\/code><\/pre>/
  },
  {
    name: 'TODO highlight - inside noparse should NOT be processed',
    input: '[noparse][todo=note]text[/todo][/noparse]',
    expected: /\[todo=note\]text\[\/todo\]/
  },
  // Section and Subsection tests
  {
    name: 'Section - with anchor',
    input: '[section=intro]Introduction[/section]',
    expected: /<h2 class="bb_section"><a name="intro"><\/a>Introduction<\/h2>/
  },
  {
    name: 'Section - without anchor',
    input: '[section]Getting Started[/section]',
    expected: /<h2 class="bb_section">Getting Started<\/h2>/
  },
  {
    name: 'Subsection - with anchor',
    input: '[subsection=details]More Details[/subsection]',
    expected: /<h2 class="bb_subsection"><a name="details"><\/a>More Details<\/h2>/
  },
  {
    name: 'Subsection - without anchor',
    input: '[subsection]Additional Info[/subsection]',
    expected: /<h2 class="bb_subsection">Additional Info<\/h2>/
  },
  {
    name: 'Section - HTML in content should be escaped',
    input: '[section=test]<script>alert(1)</script>[/section]',
    expected: /<h2 class="bb_section"><a name="test"><\/a>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/h2>/
  },
  {
    name: 'Section - multiple sections in document',
    input: '[section=first]First Section[/section]\n[section=second]Second Section[/section]',
    expected: /<h2 class="bb_section"><a name="first"><\/a>First Section<\/h2>.*<h2 class="bb_section"><a name="second"><\/a>Second Section<\/h2>/
  },
  {
    name: 'Section and subsection together',
    input: '[section=main]Main Section[/section]\n[subsection=sub1]Subsection One[/subsection]',
    expected: /<h2 class="bb_section"><a name="main"><\/a>Main Section<\/h2>.*<h2 class="bb_subsection"><a name="sub1"><\/a>Subsection One<\/h2>/
  },
  {
    name: 'Section - inside code block should NOT be processed',
    input: '[code][section=test]Title[/section][/code]',
    expected: /<pre><code>\[section=test\]Title\[\/section\]<\/code><\/pre>/
  },
  {
    name: 'Subsection - inside noparse should NOT be processed',
    input: '[noparse][subsection=test]Title[/subsection][/noparse]',
    expected: /\[subsection=test\]Title\[\/subsection\]/
  },
  // Doclink tests
  {
    name: 'Doclink - basic usage',
    input: '[doclink=getting-started]Getting Started Guide[/doclink]',
    expected: /<a href="\/wiki\/getting-started" class="doclink">Getting Started Guide<\/a>/
  },
  {
    name: 'Doclink - with underscores in slug',
    input: '[doclink=api_reference]API Reference[/doclink]',
    expected: /<a href="\/wiki\/api_reference" class="doclink">API Reference<\/a>/
  },
  {
    name: 'Doclink - multiple links',
    input: 'See [doclink=intro]Introduction[/doclink] and [doclink=setup]Setup[/doclink]',
    expected: /<a href="\/wiki\/intro" class="doclink">Introduction<\/a>.*<a href="\/wiki\/setup" class="doclink">Setup<\/a>/
  },
  {
    name: 'Doclink - HTML in link text should be escaped',
    input: '[doclink=test]<b>Bold</b>[/doclink]',
    expected: /<a href="\/wiki\/test" class="doclink">&lt;b&gt;Bold&lt;\/b&gt;<\/a>/
  },
  {
    name: 'Doclink - inside code block should NOT be processed',
    input: '[code][doclink=test]Link[/doclink][/code]',
    expected: /<pre><code>\[doclink=test\]Link\[\/doclink\]<\/code><\/pre>/
  },
  {
    name: 'Doclink - inside noparse should NOT be processed',
    input: '[noparse][doclink=test]Link[/doclink][/noparse]',
    expected: /\[doclink=test\]Link\[\/doclink\]/
  },
  {
    name: 'Doclink - with formatting inside',
    input: '[doclink=guide][b]Important[/b] Guide[/doclink]',
    expected: /<a href="\/wiki\/guide" class="doclink"><strong>Important<\/strong> Guide<\/a>/
  },
  {
    name: 'Section with doclink inside',
    input: '[section=refs]References[/section]\nSee [doclink=api]API Docs[/doclink]',
    expected: /<h2 class="bb_section"><a name="refs"><\/a>References<\/h2>.*<a href="\/wiki\/api" class="doclink">API Docs<\/a>/
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
