/**
 * Cursor Transformation Unit Tests
 */

const { assertEqual } = require('./testRunner');

// Helper functions for testing cursor transformation (same as in useCollaboration.js)
function findEditDelta(oldContent, newContent) {
  let editStart = 0;
  const minLen = Math.min(oldContent.length, newContent.length);
  while (editStart < minLen && oldContent[editStart] === newContent[editStart]) {
    editStart++;
  }

  let oldEnd = oldContent.length;
  let newEnd = newContent.length;
  while (oldEnd > editStart && newEnd > editStart &&
         oldContent[oldEnd - 1] === newContent[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }

  const lengthDiff = newContent.length - oldContent.length;
  return { editStart, lengthDiff };
}

function transformPosition(position, editStart, lengthDiff) {
  if (position <= editStart) {
    return position;
  }
  return Math.max(editStart, position + lengthDiff);
}

function registerTransformTests(runner) {
  // ============================================================
  // CURSOR TRANSFORMATION TESTS
  // ============================================================

  runner.test('CursorTransform: findEditDelta detects insertion at start', () => {
    const result = findEditDelta('Hello World', 'XXXHello World');
    assertEqual(result.editStart, 0, 'Edit start should be 0');
    assertEqual(result.lengthDiff, 3, 'Length diff should be 3');
  });

  runner.test('CursorTransform: findEditDelta detects insertion in middle', () => {
    const result = findEditDelta('Hello World', 'Hello XXXWorld');
    assertEqual(result.editStart, 6, 'Edit start should be 6');
    assertEqual(result.lengthDiff, 3, 'Length diff should be 3');
  });

  runner.test('CursorTransform: findEditDelta detects insertion at end', () => {
    const result = findEditDelta('Hello World', 'Hello WorldXXX');
    assertEqual(result.editStart, 11, 'Edit start should be 11');
    assertEqual(result.lengthDiff, 3, 'Length diff should be 3');
  });

  runner.test('CursorTransform: findEditDelta detects deletion at start', () => {
    const result = findEditDelta('XXXHello World', 'Hello World');
    assertEqual(result.editStart, 0, 'Edit start should be 0');
    assertEqual(result.lengthDiff, -3, 'Length diff should be -3');
  });

  runner.test('CursorTransform: findEditDelta detects deletion in middle', () => {
    const result = findEditDelta('Hello XXXWorld', 'Hello World');
    assertEqual(result.editStart, 6, 'Edit start should be 6');
    assertEqual(result.lengthDiff, -3, 'Length diff should be -3');
  });

  runner.test('CursorTransform: findEditDelta detects deletion at end', () => {
    const result = findEditDelta('Hello WorldXXX', 'Hello World');
    assertEqual(result.editStart, 11, 'Edit start should be 11');
    assertEqual(result.lengthDiff, -3, 'Length diff should be -3');
  });

  runner.test('CursorTransform: findEditDelta detects replacement', () => {
    const result = findEditDelta('Hello World', 'Hello Earth');
    assertEqual(result.editStart, 6, 'Edit start should be 6');
    assertEqual(result.lengthDiff, 0, 'Length diff should be 0 (same length replacement)');
  });

  runner.test('CursorTransform: transformPosition - cursor before edit stays same', () => {
    const result = transformPosition(5, 10, 3);
    assertEqual(result, 5, 'Cursor before edit should not move');
  });

  runner.test('CursorTransform: transformPosition - cursor at edit point stays same', () => {
    const result = transformPosition(10, 10, 3);
    assertEqual(result, 10, 'Cursor at edit point should not move');
  });

  runner.test('CursorTransform: transformPosition - cursor after insertion shifts right', () => {
    const result = transformPosition(15, 10, 3);
    assertEqual(result, 18, 'Cursor after insertion should shift right by length diff');
  });

  runner.test('CursorTransform: transformPosition - cursor after deletion shifts left', () => {
    const result = transformPosition(15, 10, -3);
    assertEqual(result, 12, 'Cursor after deletion should shift left by length diff');
  });

  runner.test('CursorTransform: transformPosition - cursor doesnt go negative', () => {
    const result = transformPosition(8, 5, -10);
    assertEqual(result, 5, 'Cursor should not go below edit start');
  });

  runner.test('CursorTransform: full scenario - User A types, User B cursor adjusts', () => {
    const oldContent = 'Hello World, how are you?';
    const newContent = 'Dear Hello World, how are you?';
    const userBCursor = 20;

    const { editStart, lengthDiff } = findEditDelta(oldContent, newContent);
    const newCursor = transformPosition(userBCursor, editStart, lengthDiff);

    assertEqual(editStart, 0, 'Edit should be at start');
    assertEqual(lengthDiff, 5, 'Should have added 5 chars');
    assertEqual(newCursor, 25, 'User B cursor should shift from 20 to 25');
  });

  runner.test('CursorTransform: full scenario - typing in middle shifts cursor after', () => {
    const oldContent = 'Hello World';
    const newContent = 'Hello Beautiful World';
    const userBCursor = 11;

    const { editStart, lengthDiff } = findEditDelta(oldContent, newContent);
    const newCursor = transformPosition(userBCursor, editStart, lengthDiff);

    assertEqual(editStart, 6, 'Edit should be at position 6');
    assertEqual(lengthDiff, 10, 'Should have added 10 chars');
    assertEqual(newCursor, 21, 'User B cursor should shift from 11 to 21');
  });

  runner.test('CursorTransform: full scenario - deleting before cursor shifts it left', () => {
    const oldContent = 'Hello Beautiful World';
    const newContent = 'Hello World';
    const userBCursor = 21;

    const { editStart, lengthDiff } = findEditDelta(oldContent, newContent);
    const newCursor = transformPosition(userBCursor, editStart, lengthDiff);

    assertEqual(editStart, 6, 'Edit should be at position 6');
    assertEqual(lengthDiff, -10, 'Should have removed 10 chars');
    assertEqual(newCursor, 11, 'User B cursor should shift from 21 to 11');
  });

  runner.test('CursorTransform: cursor before edit is unaffected', () => {
    const oldContent = 'Hello World';
    const newContent = 'Hello World there';
    const userBCursor = 5;

    const { editStart, lengthDiff } = findEditDelta(oldContent, newContent);
    const newCursor = transformPosition(userBCursor, editStart, lengthDiff);

    assertEqual(editStart, 11, 'Edit should be at position 11');
    assertEqual(lengthDiff, 6, 'Should have added 6 chars');
    assertEqual(newCursor, 5, 'User B cursor should stay at 5 (before edit)');
  });

  // ============================================================
  // EDIT HIGHLIGHT TESTS
  // ============================================================

  runner.test('EditHighlight: findEditDelta correctly identifies insertion range', () => {
    const oldContent = 'Hello World';
    const newContent = 'Hello Beautiful World';

    const { editStart, lengthDiff } = findEditDelta(oldContent, newContent);

    assertEqual(editStart, 6, 'Edit should start at position 6');
    assertEqual(lengthDiff, 10, 'Length diff should be 10');

    const highlightStart = editStart;
    const highlightEnd = editStart + lengthDiff;
    assertEqual(highlightStart, 6, 'Highlight should start at 6');
    assertEqual(highlightEnd, 16, 'Highlight should end at 16');

    const highlightedText = newContent.substring(highlightStart, highlightEnd);
    assertEqual(highlightedText, 'Beautiful ', 'Highlighted text should be "Beautiful "');
  });

  runner.test('EditHighlight: findEditDelta handles multiline insertions', () => {
    const oldContent = 'Line 1\nLine 2';
    const newContent = 'Line 1\nNew Line\nLine 2';

    const { editStart, lengthDiff } = findEditDelta(oldContent, newContent);

    assertEqual(editStart, 7, 'Edit should start at position 7');
    assertEqual(lengthDiff, 9, 'Length diff should be 9');

    const highlightedText = newContent.substring(editStart, editStart + lengthDiff);
    assertEqual(highlightedText, 'New Line\n', 'Highlighted text should be "New Line\\n"');
  });

  runner.test('EditHighlight: no highlight for deletions (lengthDiff <= 0)', () => {
    const oldContent = 'Hello Beautiful World';
    const newContent = 'Hello World';

    const { editStart, lengthDiff } = findEditDelta(oldContent, newContent);

    assertEqual(editStart, 6, 'Edit should start at position 6');
    assertEqual(lengthDiff, -10, 'Length diff should be -10');

    const shouldHighlight = lengthDiff > 0;
    assertEqual(shouldHighlight, false, 'Should not highlight deletions');
  });

  runner.test('EditHighlight: single character insertion', () => {
    const oldContent = 'Helo World';
    const newContent = 'Hello World';

    const { editStart, lengthDiff } = findEditDelta(oldContent, newContent);

    assertEqual(editStart, 3, 'Edit should start at position 3');
    assertEqual(lengthDiff, 1, 'Length diff should be 1');

    const highlightedText = newContent.substring(editStart, editStart + lengthDiff);
    assertEqual(highlightedText, 'l', 'Highlighted text should be "l"');
  });
}

module.exports = { registerTransformTests, findEditDelta, transformPosition };
