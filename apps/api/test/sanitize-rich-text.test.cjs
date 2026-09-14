const assert = require('node:assert/strict');
const test = require('node:test');
const {
  sanitizeRichText,
} = require('../dist/modules/calendar-events/rich-text/sanitize-rich-text');

test('keeps the allowed rich text subset', () => {
  const input =
    '<p>Hello <strong>bold</strong> <em>em</em> <u>u</u> <s>s</s></p><ul><li><p>One</p></li></ul><ol><li>Two<br></li></ol>';
  assert.equal(
    sanitizeRichText(input),
    '<p>Hello <strong>bold</strong> <em>em</em> <u>u</u> <s>s</s></p><ul><li><p>One</p></li></ul><ol><li>Two<br /></li></ol>',
  );
});

test('removes scripts, event handlers, styles and unknown tags', () => {
  assert.equal(
    sanitizeRichText(
      '<p onclick="x()">Hi</p><script>alert(1)</script><img src=x onerror=alert(1)><div style="color:red">text</div><iframe src="https://evil"></iframe>',
    ),
    '<p>Hi</p>text',
  );
});

test('allows only http and https links and strips other link attributes', () => {
  assert.equal(
    sanitizeRichText('<p><a href="https://example.com" target="_blank" onclick="x()">ok</a></p>'),
    '<p><a href="https://example.com">ok</a></p>',
  );
  assert.equal(
    sanitizeRichText('<p><a href="javascript:alert(1)">bad</a></p>'),
    '<p><a>bad</a></p>',
  );
  assert.equal(
    sanitizeRichText('<p><a href="data:text/html;base64,AAA">bad</a></p>'),
    '<p><a>bad</a></p>',
  );
});

test('normalizes empty content to null', () => {
  assert.equal(sanitizeRichText(null), null);
  assert.equal(sanitizeRichText(undefined), null);
  assert.equal(sanitizeRichText(''), null);
  assert.equal(sanitizeRichText('<p></p>'), null);
  assert.equal(sanitizeRichText('<p></p><p><br></p>'), null);
  assert.equal(sanitizeRichText('   '), null);
});

test('drops the trailing empty paragraphs an editor leaves behind', () => {
  assert.equal(sanitizeRichText('<p>Text</p><p></p><p><br></p>'), '<p>Text</p>');
  assert.equal(sanitizeRichText('<p></p><p>Text</p>'), '<p></p><p>Text</p>');
});
