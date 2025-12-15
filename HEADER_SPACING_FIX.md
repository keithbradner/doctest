# Header Spacing Fix for BBCode Elements

## Issue
Header element spacing in BBCode did not match the Steam Steamworks documentation (example.mhtml).

## Root Cause
The H2 element had incorrect margins compared to the Steam documentation styles.

## Changes Made

### H2 Margin Adjustments
**File:** `client/src/App.css:333-334`

**Before:**
```css
.page-content h2 {
  margin-top: 8px;
  margin-bottom: 6px;
}
```

**After:**
```css
.page-content h2 {
  margin-top: 20px;
  margin-bottom: 4px;
}
```

## Steam Documentation Reference

From `example.mhtml`, the header spacing is defined as:

### H2 Base Styles
```css
.documentation_bbcode h2 {
  margin-top: 20px;
  margin-bottom: 10px;
  line-height: 1.5em;
}

.documentation_bbcode h2 {
  margin-bottom: 0px; /* Override */
}

.documentation_bbcode h2.bb_subsection {
  font-size: 18px;
  color: rgb(221, 224, 228);
  margin-bottom: 4px;
  padding-top: 5px;
  font-family: "Motiva Sans", sans-serif;
  font-weight: 300;
}
```

**Effective H2 styles (bb_subsection):**
- margin-top: **20px** (from base .documentation_bbcode h2)
- margin-bottom: **4px** (from bb_subsection, overrides 0px)
- padding-top: 5px
- font-size: 18px
- color: rgb(221, 224, 228)
- line-height: 1.5em
- font-weight: 300

## Header Spacing Summary

All header elements now match Steam documentation:

### H1 (styled as bb_section)
✅ Already correct:
- margin-top: 40px
- margin-bottom: 6px
- font-size: 22px
- color: white
- border-bottom: 1px solid rgba(255, 255, 255, 0.2)
- line-height: 1.5em
- font-weight: 300

### H2 (styled as bb_subsection)
✅ **NOW FIXED:**
- margin-top: 20px ← **CHANGED from 8px**
- margin-bottom: 4px ← **CHANGED from 6px**
- padding-top: 5px
- font-size: 18px
- color: rgb(221, 224, 228)
- line-height: 1.5em
- font-weight: 300

### H3
✅ Already correct:
- margin-top: 8px
- margin-bottom: 6px
- font-size: 16px
- color: rgb(103, 193, 245)
- line-height: 1.5em
- font-weight: normal

## Visual Impact

### Before Fix
- H2 elements appeared too close to preceding content (8px gap)
- Bottom spacing was slightly larger than Steam (6px vs 4px)
- Headers felt cramped and didn't breathe properly

### After Fix
- H2 elements have proper spacing above them (20px gap)
- Bottom spacing matches Steam exactly (4px)
- Headers now have the same visual rhythm as Steam documentation
- Content hierarchy is clearer with proper spacing

## Testing

Build successful:
```bash
cd client && npm run build
```

**Result:** ✅ Compiled successfully

No warnings or errors.

## Related Files
- `client/src/App.css` - Updated H2 margins
- `shared/bbcode.js` - BBCode parser (generates h1, h2, h3 elements)
- `example.mhtml` - Reference Steam documentation

## Notes

The spacing now matches Steam's documentation_bbcode styles exactly. The H2 element is styled as `bb_subsection` which is the standard content heading style in Steam documentation.

H1 elements are styled as `bb_section` which is used for major section breaks and already had correct spacing.

---

**Fixed:** 2025-12-14
**Reference:** example.mhtml (Steam Steamworks Documentation)
