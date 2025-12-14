# BBCode Editor Toolbar Features

## New Features Added

### Hover States
All toolbar buttons now have enhanced hover effects:
- **Background change**: Lighter background on hover (#232830)
- **Border highlight**: Blue border (#67C1F5) appears on hover
- **Text brightness**: Text becomes brighter (#E5E5E5)
- **Lift effect**: Button moves up 1px with shadow
- **Active state**: Button presses down when clicked

### Line Break Button
A new button (⏎) has been added to both editors:
- **Location**: After the HR button in the main editor, after Link in comments
- **Function**: Inserts two newlines (`\n\n`) to create blank lines
- **Usage**: Click to add spacing between paragraphs
- **Tooltip**: "Insert blank line" on hover

### YouTube Video Embed
A new button (▶ YouTube) has been added to the main editor:
- **Location**: After the line break button
- **Function**: Inserts `[previewyoutube][/previewyoutube]` tags for embedding YouTube videos
- **Usage**: Click the button, then paste the YouTube video ID between the tags
  - Example: `[previewyoutube]dQw4w9WgXcQ[/previewyoutube]`
  - The video ID is the part after `v=` in a YouTube URL
- **Rendering**: Creates a responsive 16:9 embedded player
- **Tooltip**: "YouTube video (paste video ID)" on hover

### Link Underlines
All links now have underlines for better accessibility:
- **Page content links**: Underlined by default
- **Breadcrumb links**: Underlined
- **Comment links**: Underlined
- **Admin table links**: Underlined
- **Hover behavior**: Color changes on hover (no additional underline)

## Toolbar Buttons Reference

### Main Editor (PageEdit.js)
1. **H1, H2, H3** - Heading levels
2. **B, I, U, S** - Bold, Italic, Underline, Strikethrough
3. **Link** - Insert URL
4. **List, OList** - Unordered and ordered lists
5. **Code** - Code formatting
6. **Quote** - Blockquote
7. **Callout** - Special callout box
8. **Spoiler** - Spoiler tag
9. **HR** - Horizontal rule
10. **⏎** - Insert blank line
11. **▶ YouTube** - YouTube video embed (NEW)
12. **Upload Image** - Image upload

### Comment Editor (PageTalk.js)
1. **B, I, U** - Bold, Italic, Underline
2. **Code** - Code formatting
3. **Link** - Insert URL
4. **⏎** - Insert blank line (NEW)

## CSS Classes

### Toolbar Button Styles
```css
.toolbar-btn {
  background: #161920;
  border: 1px solid #3d4450;
  color: #ACB5BE;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: #232830;
  border-color: #67C1F5;
  color: #E5E5E5;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.toolbar-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
```

### Image Upload Button
```css
.image-upload-btn:hover {
  background: #88d0f7;
  border-color: #88d0f7;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(103, 193, 245, 0.4);
}
```

### YouTube Video Embed Styles
```css
.page-content .youtube-embed {
  position: relative;
  padding-bottom: 56.25%;
  padding-top: 25px;
  height: 0;
  margin: 15px 0;
  max-width: 1280px;
}

.page-content .youtube-embed iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}
```

## Usage Examples

### Adding Spacing in Content
Click the ⏎ button to insert blank lines between paragraphs for better readability:

```
This is paragraph one.

This is paragraph two with spacing above.
```

### Keyboard Alternative
You can also manually press Enter twice to create the same effect.

### Embedding YouTube Videos
To embed a YouTube video in your page content:

1. Click the **▶ YouTube** button in the toolbar
2. Paste the YouTube video ID between the tags
   ```
   [previewyoutube]dQw4w9WgXcQ[/previewyoutube]
   ```
3. To find a video ID:
   - From URL `https://www.youtube.com/watch?v=dQw4w9WgXcQ` → ID is `dQw4w9WgXcQ`
   - From short URL `https://youtu.be/dQw4w9WgXcQ` → ID is `dQw4w9WgXcQ`
4. The video will render as a responsive 16:9 embedded player
5. Maximum width: 1280px (matches Steam documentation style)

## Visual Feedback

The hover states provide clear visual feedback:
1. **Idle**: Dark button with muted text
2. **Hover**: Lighter button with blue border and bright text, slightly raised
3. **Click**: Button presses down momentarily
4. **Release**: Returns to hover state

This makes the toolbar more interactive and provides better user experience matching modern UI standards.
