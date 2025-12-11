// Simple diff utility for text comparison
const generateDiff = (oldText, newText) => {
  if (!oldText && !newText) return '';
  if (!oldText) return `+++ All content added +++\n${newText}`;
  if (!newText) return `--- All content removed ---\n${oldText}`;

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const diff = [];
  let i = 0, j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      // Only new lines remain
      diff.push({ type: 'add', line: newLines[j], lineNum: j + 1 });
      j++;
    } else if (j >= newLines.length) {
      // Only old lines remain
      diff.push({ type: 'remove', line: oldLines[i], lineNum: i + 1 });
      i++;
    } else if (oldLines[i] === newLines[j]) {
      // Lines match
      diff.push({ type: 'same', line: oldLines[i], lineNum: i + 1 });
      i++;
      j++;
    } else {
      // Lines differ - check if it's a change or insertion/deletion
      let foundMatch = false;

      // Look ahead to see if old line appears later in new
      for (let k = j + 1; k < Math.min(j + 5, newLines.length); k++) {
        if (oldLines[i] === newLines[k]) {
          // Old line found later, so lines were inserted
          diff.push({ type: 'add', line: newLines[j], lineNum: j + 1 });
          j++;
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        // Look ahead to see if new line appears later in old
        for (let k = i + 1; k < Math.min(i + 5, oldLines.length); k++) {
          if (newLines[j] === oldLines[k]) {
            // New line found later, so lines were deleted
            diff.push({ type: 'remove', line: oldLines[i], lineNum: i + 1 });
            i++;
            foundMatch = true;
            break;
          }
        }
      }

      if (!foundMatch) {
        // It's a change
        diff.push({ type: 'remove', line: oldLines[i], lineNum: i + 1 });
        diff.push({ type: 'add', line: newLines[j], lineNum: j + 1 });
        i++;
        j++;
      }
    }
  }

  // Format diff as text
  return formatDiff(diff);
};

const formatDiff = (diff) => {
  return diff.map(item => {
    switch (item.type) {
      case 'add':
        return `+ ${item.line}`;
      case 'remove':
        return `- ${item.line}`;
      case 'same':
        return `  ${item.line}`;
      default:
        return item.line;
    }
  }).join('\n');
};

// Parse diff text back into structured format for display
const parseDiff = (diffText) => {
  if (!diffText) return [];

  const lines = diffText.split('\n');
  return lines.map((line, index) => {
    if (line.startsWith('+ ')) {
      return { type: 'add', line: line.substring(2), lineNum: index + 1 };
    } else if (line.startsWith('- ')) {
      return { type: 'remove', line: line.substring(2), lineNum: index + 1 };
    } else if (line.startsWith('  ')) {
      return { type: 'same', line: line.substring(2), lineNum: index + 1 };
    } else {
      return { type: 'info', line: line, lineNum: index + 1 };
    }
  });
};

module.exports = { generateDiff, parseDiff };
