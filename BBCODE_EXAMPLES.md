# BBCode Examples and Test Cases

## Protected Blocks (No BBCode Processing)

### Code Blocks
Code blocks display content exactly as written with HTML escaping. BBCode tags are NOT processed.

```
[code]
[b]This is not bold[/b]
[img]https://example.com/image.png[/img]
[url=https://test.com]Not a link[/url]
<script>alert("XSS")</script>
[/code]
```

**Result:** All BBCode tags and HTML are displayed as literal text.

### Noparse Blocks
Noparse blocks display BBCode tags literally with HTML escaping.

```
[noparse]
[h1]Not a header[/h1]
[b]Not bold[/b] [i]Not italic[/i]
[list][*]Not a list item[/list]
<div>HTML is escaped</div>
[/noparse]
```

**Result:** BBCode tags are shown as text, HTML is escaped.

## Text Formatting

```
[b]Bold text[/b]
[i]Italic text[/i]
[u]Underlined text[/u]
[strike]Strikethrough text[/strike]
[spoiler]Hidden spoiler text[/spoiler]
```

## Headers

```
[h1]Main Header[/h1]
[h2]Sub Header[/h2]
[h3]Section Header[/h3]
```

## Links and Images

```
[url=https://example.com]Link text[/url]
[url]https://example.com[/url]
[img]https://example.com/image.png[/img]
```

## Lists

### Unordered List
```
[list]
[*]First item
[*]Second item
[*]Third item
[/list]
```

### Ordered List
```
[olist]
[*]First item
[*]Second item
[*]Third item
[/olist]
```

## Quotes

### Simple Quote
```
[quote]This is a quoted text[/quote]
```

### Quote with Attribution
```
[quote=John Doe]This is what John said[/quote]
```

## Other Elements

### Horizontal Rule
```
Text above
[hr]
Text below
```

## Nesting

BBCode tags can be nested (except within code/noparse):

```
[b]Bold and [i]italic[/i] together[/b]
[quote][b]Bold quote[/b] with [url=test]link[/url][/quote]
```

## Security Features

### XSS Prevention in Code Blocks
```
[code]<script>alert("XSS")</script>[/code]
```
**Result:** `<script>` is escaped to `&lt;script&gt;`

### XSS Prevention in Noparse
```
[noparse]<img src=x onerror=alert(1)>[/noparse]
```
**Result:** HTML is escaped and displayed as text

### BBCode Injection Prevention
```
[code][img]javascript:alert(1)[/img][/code]
[noparse][url=javascript:void(0)]Click[/url][/noparse]
```
**Result:** BBCode tags are NOT processed, shown as literal text

## Line Spacing

### Single Line Break
```
Line 1
Line 2
```
**Result:** Converted to `<br>` tag

### Paragraph Break (Double Line Break)
```
Paragraph 1

Paragraph 2
```
**Result:** Wrapped in separate `<p>` tags

### No Extra Spacing After Block Elements
```
[h1]Header[/h1]
Content immediately follows
```
**Result:** No extra `<br>` tags inserted after headers, lists, etc.

## Testing

Run the BBCode test suite:
```bash
npm run test:bbcode
```

Run all tests:
```bash
npm run test:all
```

Expected output: ✅ All tests passed! (25/25 BBCode tests)
