const assert = require('node:assert/strict');
const test = require('node:test');
const {
  richTextToPlainText,
  richTextToPlainTextBlocks,
  richTextToTelegramHtml,
  richTextToTelegramHtmlBlocks,
} = require('../dist/modules/telegram-bot/rich-text-telegram');

test('maps inline marks to the Telegram HTML subset', () => {
  assert.equal(
    richTextToTelegramHtml(
      '<p>Hello <strong>bold</strong>, <em>italic</em>, <u>u</u>, <s>s</s></p>',
    ),
    'Hello <b>bold</b>, <i>italic</i>, <u>u</u>, <s>s</s>',
  );
});

test('separates paragraphs with blank lines and keeps line breaks', () => {
  assert.equal(
    richTextToTelegramHtml('<p>First<br>line</p><p>Second</p><p></p>'),
    'First\nline\n\nSecond',
  );
});

test('renders bullet and numbered lists with nested indentation', () => {
  assert.equal(
    richTextToTelegramHtml(
      '<p>Order:</p><ul><li><p>Welcome</p></li><li><p>Worship</p><ol><li><p>Song A</p></li><li><p>Song B</p></li></ol></li></ul>',
    ),
    'Order:\n\n• Welcome\n• Worship\n  1. Song A\n  2. Song B',
  );
});

test('keeps http links and drops unsafe ones', () => {
  assert.equal(
    richTextToTelegramHtml('<p><a href="https://example.com/a?b=1&amp;c=2">Site</a></p>'),
    '<a href="https://example.com/a?b=1&amp;c=2">Site</a>',
  );
  assert.equal(richTextToTelegramHtml('<p><a href="javascript:alert(1)">Click</a></p>'), 'Click');
});

test('strips unknown tags and escapes their text content', () => {
  assert.equal(
    richTextToTelegramHtml('<p>Hi <script>alert("x")</script><img src=x onerror=alert(1)></p>'),
    'Hi alert("x")',
  );
  assert.equal(
    richTextToTelegramHtml('<h1>Title</h1><div>a &lt; b &amp; c</div>'),
    'Titlea &lt; b &amp; c',
  );
});

test('treats legacy plain text descriptions as text', () => {
  assert.equal(
    richTextToTelegramHtml('Bring <bread> & wine\nat 10:00'),
    'Bring  &amp; wine\nat 10:00',
  );
  assert.equal(
    richTextToPlainText('<p><strong>Bold</strong> text</p><ul><li><p>One</p></li></ul>'),
    'Bold text\n\n• One',
  );
});

test('exposes paragraphs and lists as separate blocks in both renderings', () => {
  const source = '<p>One <strong>two</strong></p><ul><li><p>Three</p></li></ul>Loose text';

  assert.deepEqual(richTextToTelegramHtmlBlocks(source), [
    'One <b>two</b>',
    '• Three',
    'Loose text',
  ]);
  assert.deepEqual(richTextToPlainTextBlocks(source), ['One two', '• Three', 'Loose text']);
});
