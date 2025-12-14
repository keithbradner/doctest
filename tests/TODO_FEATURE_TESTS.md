# TODO Feature Test Documentation

## Overview
This document describes the test coverage for the TODO highlight feature with tooltip functionality.

## Running the Tests

```bash
# Run all BBCode tests (includes TODO tests)
npm run test:bbcode

# Run all tests
npm run test:all
```

## Test Coverage

The TODO feature has **11 comprehensive tests** covering:

### 1. Basic Functionality
- **Test**: TODO highlight - basic usage
- **Input**: `[todo=need to confirm with bob]pricing details[/todo]`
- **Validates**: Correct HTML structure with `data-todo` attribute
- **Expected**: `<span class="todo-highlight" data-todo="need to confirm with bob">pricing details</span>`

### 2. Special Characters
- **Test**: TODO highlight - with special characters in note
- **Input**: `[todo=verify this (urgent!)]commission rate[/todo]`
- **Validates**: Parentheses and exclamation marks are preserved
- **Expected**: Correct rendering with special characters

### 3. Security - HTML Escaping
- **Test**: TODO highlight - HTML in note should be escaped
- **Input**: `[todo=<script>alert(1)</script>]text[/todo]`
- **Validates**: XSS prevention - HTML is properly escaped
- **Expected**: `<span class="todo-highlight" data-todo="&lt;script&gt;alert(1)&lt;/script&gt;">text</span>`

### 4. Edge Cases - Empty Note
- **Test**: TODO highlight - empty note
- **Input**: `[todo=]highlighted text[/todo]`
- **Validates**: Handles empty TODO notes gracefully
- **Expected**: `<span class="todo-highlight" data-todo="">highlighted text</span>`

### 5. Multiple TODOs
- **Test**: TODO highlight - multiple TODOs in one line
- **Input**: `[todo=check A]first[/todo] and [todo=check B]second[/todo]`
- **Validates**: Multiple TODO tags work independently
- **Expected**: Both TODO highlights render correctly

### 6. Nested Formatting
- **Test**: TODO highlight - with bold formatting inside
- **Input**: `[todo=review this][b]important text[/b][/todo]`
- **Validates**: BBCode formatting works inside TODO tags
- **Expected**: `<span class="todo-highlight" data-todo="review this"><strong>important text</strong></span>`

### 7. Quote Escaping
- **Test**: TODO highlight - quotes in note should be escaped
- **Input**: `[todo=Bob said "check this"]content[/todo]`
- **Validates**: Quote marks are properly escaped in HTML attributes
- **Expected**: `<span class="todo-highlight" data-todo="Bob said &quot;check this&quot;">content</span>`

### 8. Mixed Content
- **Test**: TODO highlight - mixed with other formatting
- **Input**: `Regular text [todo=verify]this part[/todo] and [b]bold text[/b]`
- **Validates**: TODO works alongside other BBCode
- **Expected**: Correct rendering of mixed content

### 9. Long Notes
- **Test**: TODO highlight - long note text
- **Input**: `[todo=need to update this after the Q4 meeting with stakeholders]quarterly targets[/todo]`
- **Validates**: Long TODO notes are handled correctly
- **Expected**: Full note text preserved in `data-todo` attribute

### 10. Code Block Protection
- **Test**: TODO highlight - inside code block should NOT be processed
- **Input**: `[code][todo=note]text[/todo][/code]`
- **Validates**: TODO tags inside code blocks remain as literal text
- **Expected**: `<pre><code>[todo=note]text[/todo]</code><pre>`

### 11. Noparse Protection
- **Test**: TODO highlight - inside noparse should NOT be processed
- **Input**: `[noparse][todo=note]text[/todo][/noparse]`
- **Validates**: TODO tags inside noparse blocks remain as literal text
- **Expected**: `[todo=note]text[/todo]` (escaped)

## Security Considerations

The tests verify that:
1. **HTML injection is prevented** - All HTML in TODO notes is escaped
2. **XSS attacks are blocked** - Script tags are escaped
3. **Attribute injection is prevented** - Quotes in notes are escaped
4. **Code blocks are protected** - TODO syntax inside code blocks is not processed

## Feature Integration

The TODO feature integrates with:
- ✅ All BBCode formatting tags (bold, italic, etc.)
- ✅ Security features (HTML escaping)
- ✅ Code blocks (properly ignored)
- ✅ Noparse blocks (properly ignored)
- ✅ Multiple instances per page

## Test Results

All 43 BBCode tests pass, including:
- 32 existing BBCode tests
- **11 new TODO feature tests**

```
Results: 43 passed, 0 failed out of 43 tests
✅ All tests passed!
```

## Visual Verification

While automated tests verify the HTML output, manual testing should verify:
- Yellow background highlight appears
- Dotted yellow underline displays correctly
- Help cursor (question mark) shows on hover
- Tooltip appears above highlighted text on hover
- Tooltip has yellow background with black text
- Tooltip arrow points to highlighted text
- Tooltip fades in/out smoothly

## Files Modified

1. `shared/bbcode.js` - Added TODO parsing logic
2. `client/src/utils/bbcode.js` - Updated parser copy
3. `client/src/App.css` - Added TODO CSS styles
4. `tests/bbcode.test.js` - Added 11 TODO tests
5. `client/src/components/PageEdit.js` - Added TODO toolbar button

## Usage Example

```bbcode
This is [todo=need to confirm with bob]pricing information[/todo] that needs review.

The [todo=verify this number]5.2% commission rate[/todo] should be double-checked.

After the meeting, update [todo=update after Q4 meeting]quarterly targets[/todo].
```

## Maintenance Notes

When updating the BBCode parser:
1. Run `npm run test:bbcode` to verify TODO tests still pass
2. Copy `shared/bbcode.js` to `client/src/utils/bbcode.js` after changes
3. Verify both client build and tests pass
4. Check visual appearance in browser after CSS changes
